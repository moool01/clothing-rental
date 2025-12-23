import React from 'react';
import { DesignSizeInventory, Rental, Purchase } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

interface StatisticsReportsProps {
  inventory: DesignSizeInventory[];
  rentals: Rental[];
  purchases: Purchase[];
}

export const StatisticsReports: React.FC<StatisticsReportsProps> = ({
  inventory,
}) => {
  const { role } = useAuth();

  if (role !== 'admin') {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-gray-500">
          관리자 권한이 필요합니다.
        </h2>
      </div>
    );
  }

  /* =========================
     1. 수익 분석 (현재 대여중 기준)
     ========================= */
  const totalRentalRevenue = inventory.reduce(
    (sum, item) =>
      sum +
      ((item.rented_quantity ?? 0) * (item.rental_price ?? 0)),
    0
  );

  const highRentalItems = inventory
    .filter(
      (x) =>
        x.inventory_type === '대여용' &&
        ((x.total_quantity ?? 0) - (x.rented_quantity ?? 0)) > 0
    )
    .map((x) => {
      const rented = x.rented_quantity ?? 0;
      const total = x.total_quantity ?? 0;
      const available = total - rented;

      return {
        ...x,
        utilizationRate:
          available > 0
            ? Math.round((rented / available) * 100)
            : 0,
      };
    })
    .sort((a, b) => b.utilizationRate - a.utilizationRate)
    .slice(0, 5);

  /* =========================
     3. 판매량 높은 아이템 TOP 5
     ========================= */
  const highPurchaseItems = inventory
    .filter((x) => x.inventory_type === '구매용')
    .sort(
      (a, b) =>
        (b.sold_quantity ?? 0) - (a.sold_quantity ?? 0)
    )
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ================= 수익 분석 ================= */}
      <Card>
        <CardHeader>
          <CardTitle>수익 분석 (현재 대여중 기준)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 bg-purple-50 rounded">
            <div className="text-2xl font-bold text-purple-600">
              {totalRentalRevenue.toLocaleString()}원
            </div>
            <div className="text-sm text-gray-600">
              현재 대여중 예상 매출
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= 인기 아이템 분석 ================= */}
      <Card>
        <CardHeader>
          <CardTitle>인기 아이템 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 대여율 TOP 5 */}
            <div>
              <h4 className="font-medium mb-2 text-blue-800">
                대여율 높은 아이템 TOP 5
              </h4>
              <div className="space-y-2">
                {highRentalItems.length === 0 ? (
                  <div className="text-sm text-gray-400">
                    대여 데이터가 없습니다.
                  </div>
                ) : (
                  highRentalItems.map((x, idx) => (
                    <div
                      key={x.id}
                      className="flex justify-between items-center p-2 bg-blue-50 rounded text-sm"
                    >
                      <span>
                        {idx + 1}. {x.design_name} ({x.size})
                      </span>
                      <span className="font-medium">
                        이용율 {x.utilizationRate}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 판매량 TOP 5 */}
            <div>
              <h4 className="font-medium mb-2 text-purple-800">
                판매량 높은 아이템 TOP 5
              </h4>
              <div className="space-y-2">
                {highPurchaseItems.length === 0 ? (
                  <div className="text-sm text-gray-400">
                    판매 데이터가 없습니다.
                  </div>
                ) : (
                  highPurchaseItems.map((x, idx) => (
                    <div
                      key={x.id}
                      className="flex justify-between items-center p-2 bg-purple-50 rounded text-sm"
                    >
                      <span>
                        {idx + 1}. {x.design_name} ({x.size})
                      </span>
                      <span className="font-medium">
                        {x.sold_quantity ?? 0}개 판매
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};