import React from 'react';
import { DesignSizeInventory, Rental, Purchase } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface StatisticsReportsProps {
  inventory: DesignSizeInventory[];
  rentals: Rental[]; // Passed for potential future calculations
  purchases: Purchase[]; // Passed for potential future calculations
}

export const StatisticsReports: React.FC<StatisticsReportsProps> = ({
  inventory,
  rentals,
  purchases,
}) => {
  const { role } = useAuth();

  if (role !== 'admin') {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-gray-500">관리자 권한이 필요합니다.</h2>
      </div>
    );
  }

  // Revenue Analysis
  // 1. Rental Revenue: Sum of rental_price from all rentals (historical)
  // 2. Purchase Revenue: Sum of purchase_price from all purchases (historical)
  const totalRentalRevenue = rentals.reduce((sum, r) => sum + (r.rental_price || 0), 0);
  const totalPurchaseRevenue = purchases.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
  const totalRevenue = totalRentalRevenue + totalPurchaseRevenue;

  // High Rental Rate Items
  // Calculate rental frequency per design/size from history
  const rentalCounts: Record<string, { name: string, size: string, count: number }> = {};
  rentals.forEach(r => {
    const key = `${r.design_code}-${r.size}`;
    if (!rentalCounts[key]) {
      rentalCounts[key] = { name: r.design_name, size: r.size, count: 0 };
    }
    rentalCounts[key].count += 1;
  });
  const sortedRentalItems = Object.values(rentalCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  // High Purchase Rate Items
  const purchaseCounts: Record<string, { name: string, size: string, count: number }> = {};
  purchases.forEach(p => {
    const key = `${p.design_code}-${p.size}`;
    if (!purchaseCounts[key]) {
      purchaseCounts[key] = { name: p.design_name, size: p.size, count: 0 };
    }
    purchaseCounts[key].count += p.quantity;
  });
  const sortedPurchaseItems = Object.values(purchaseCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle>수익 분석</CardTitle>
            <CardDescription>전체 기간 동안의 대여 및 판매 수익 현황입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center border">
              <div className="text-sm text-gray-500 mb-1">총 매출</div>
              <div className="text-2xl font-bold text-gray-900">{totalRevenue.toLocaleString()}원</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center border border-blue-100">
              <div className="text-sm text-blue-600 mb-1">대여 매출</div>
              <div className="text-xl font-bold text-blue-800">{totalRentalRevenue.toLocaleString()}원</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center border border-purple-100">
              <div className="text-sm text-purple-600 mb-1">판매 매출</div>
              <div className="text-xl font-bold text-purple-800">{totalPurchaseRevenue.toLocaleString()}원</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">대여율 높은 아이템 TOP 5</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>순위</TableHead>
                            <TableHead>디자인명</TableHead>
                            <TableHead>사이즈</TableHead>
                            <TableHead className="text-right">대여 횟수</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedRentalItems.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center">데이터 없음</TableCell></TableRow>
                        ) : sortedRentalItems.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.size}</TableCell>
                                <TableCell className="text-right font-medium">{item.count}회</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">구매율 높은 아이템 TOP 5</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>순위</TableHead>
                            <TableHead>디자인명</TableHead>
                            <TableHead>사이즈</TableHead>
                            <TableHead className="text-right">판매 수량</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {sortedPurchaseItems.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center">데이터 없음</TableCell></TableRow>
                        ) : sortedPurchaseItems.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.size}</TableCell>
                                <TableCell className="text-right font-medium">{item.count}개</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};
