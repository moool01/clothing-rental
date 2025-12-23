import React from 'react';
import { DesignSizeInventory, Rental, Purchase, Shipment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

interface StatisticsReportsProps {
  inventory: DesignSizeInventory[];
  rentals: Rental[];
  purchases: Purchase[]; // 지금은 안 쓰지만 props 유지
  shipments: Shipment[]; // ✅ 판매 분석은 출고일 기준
  weekStart: string;     // 'YYYY-MM-DD'
  weekEnd: string;       // 'YYYY-MM-DD'
}

export const StatisticsReports: React.FC<StatisticsReportsProps> = ({
  inventory,
  rentals,
  purchases, // eslint-disable-line @typescript-eslint/no-unused-vars
  shipments,
  weekStart,
  weekEnd,
}) => {
  const { role } = useAuth();

  if (role !== 'admin') {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-gray-500">관리자 권한이 필요합니다.</h2>
      </div>
    );
  }

  // 날짜 문자열(YYYY-MM-DD) 비교는 사전순 == 날짜순이라 그대로 써도 OK
  const overlapsWeek = (start: string, end: string) => start <= weekEnd && end >= weekStart;

  // =========================
  // 0) 빠른 매핑(가격/보유량)
  // =========================
  const priceByKey = new Map<string, number>();
  const totalByKey = new Map<string, number>();

  for (const x of inventory) {
    const key = `${x.design_code}__${x.size}`;
    priceByKey.set(key, x.rental_price ?? 0);
    totalByKey.set(key, x.total_quantity ?? 0);
  }

  // =========================
  // 1) 주간 대여 필터 (겹침 기준)
  // =========================
  const weeklyRentals = (rentals ?? []).filter(r =>
    r.rental_date && r.return_due_date ? overlapsWeek(r.rental_date, r.return_due_date) : false
  );

  // 주간 대여중 수량(아이템별)
  const weeklyRentedQtyByKey = new Map<string, number>();
  for (const r of weeklyRentals) {
    const key = `${r.design_code}__${r.size}`;
    const qty = Number(r.quantity ?? 0);
    weeklyRentedQtyByKey.set(key, (weeklyRentedQtyByKey.get(key) ?? 0) + qty);
  }

  // =========================
  // 2) 주간 출고 필터 (출고일 기준)
  // =========================
  const weeklyPurchases = (purchases ?? []).filter(p =>
    p.purchase_date
      ? p.purchase_date >= weekStart && p.purchase_date <= weekEnd
      : false
  );

  // 주간 판매(출고) 수량(아이템별)
  const weeklySoldQtyByKey = new Map<string, number>();
  for (const p of weeklyPurchases) {
    const key = `${p.design_code}__${p.size}`;
    const qty = Number(p.quantity ?? 0);
    weeklySoldQtyByKey.set(key, (weeklySoldQtyByKey.get(key) ?? 0) + qty);
  }

  // =========================
  // A) 수익 분석 (선택 주간 '대여중' 기준 예상 매출)
  // =========================
  const weeklyRentalRevenue = weeklyRentals.reduce((sum, r) => {
    const key = `${r.design_code}__${r.size}`;
    const qty = Number(r.quantity ?? 0);

    // rentals 테이블에 rental_price가 있으면 그걸 우선, 없으면 inventory 매핑 가격 사용
    const price = Number((r as any).rental_price ?? priceByKey.get(key) ?? 0);

    return sum + qty * price;
  }, 0);

  // =========================
  // B) 대여율 높은 아이템 TOP 5
  //    (요청대로: '주간 대여중 수량 / 보유량(total_quantity)')
  // =========================
  const highRentalItems = inventory
    .filter(x => x.inventory_type === '대여용' && (x.total_quantity ?? 0) > 0)
    .map(x => {
      const key = `${x.design_code}__${x.size}`;
      const rented = weeklyRentedQtyByKey.get(key) ?? 0;
      const total = x.total_quantity ?? 0;
      const utilizationRate = total > 0 ? Math.round((rented / total) * 100) : 0;

      return { ...x, utilizationRate, weeklyRented: rented };
    })
    .sort((a, b) => b.utilizationRate - a.utilizationRate)
    .slice(0, 5);

  // =========================
  // C) 판매(출고) 분석 TOP 5 (주간 출고량)
  // =========================
  const highSoldItems = inventory
    .filter(x => x.inventory_type === '구매용')
    .map(x => {
      const key = `${x.design_code}__${x.size}`;
      const weeklySold = weeklySoldQtyByKey.get(key) ?? 0;
      return { ...x, weeklySold };
    })
    .filter(x => x.weeklySold > 0) // 0개는 숨기는 게 보기 좋음
    .sort((a, b) => b.weeklySold - a.weeklySold)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1) 수익 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>수익 분석 (현재 대여중 기준)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              선택 주간: <span className="font-medium">{weekStart}</span> ~{' '}
              <span className="font-medium">{weekEnd}</span>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {weeklyRentalRevenue.toLocaleString()}원
              </div>
              <div className="text-sm text-gray-600">선택 주간 대여중 예상 매출</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2) 대여율 TOP 5 */}
      <Card>
        <CardHeader>
          <CardTitle>대여율 높은 아이템 TOP 5</CardTitle>
        </CardHeader>
        <CardContent>
          {highRentalItems.length === 0 ? (
            <div className="text-sm text-gray-500">해당 주간에 집계할 대여 아이템이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {highRentalItems.map((x, idx) => (
                <div
                  key={x.id}
                  className="flex justify-between items-center p-2 bg-blue-50 rounded text-sm"
                >
                  <span>
                    {idx + 1}. {x.design_name} ({x.size})
                  </span>
                  <span className="font-medium">
                    이용율 {x.utilizationRate}%{' '}
                    <span className="text-gray-500">
                      ({(x as any).weeklyRented ?? 0}/{x.total_quantity ?? 0})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3) 판매(출고) 분석 */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>판매 분석 (구매일 기준) TOP 5</CardTitle>
        </CardHeader>
        <CardContent>
          {highSoldItems.length === 0 ? (
            <div className="text-sm text-gray-500">선택 주간에 판매 기록이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {highSoldItems.map((x, idx) => (
                <div
                  key={x.id}
                  className="flex justify-between items-center p-2 bg-purple-50 rounded text-sm"
                >
                  <span>
                    {idx + 1}. {x.design_name} ({x.size})
                  </span>
                  <span className="font-medium">{(x as any).weeklySold}개 판매</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};