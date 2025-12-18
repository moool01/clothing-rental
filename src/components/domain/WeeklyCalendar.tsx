import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DesignSizeInventory, WeekRange } from '@/types';

interface WeeklyCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date | undefined) => void;
  selectedWeekRange: WeekRange;
  weeklyInventorySoldOut: DesignSizeInventory[];
  allWeeklyInventory: DesignSizeInventory[];
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  selectedDate,
  onDateSelect,
  selectedWeekRange,
  weeklyInventorySoldOut,
  allWeeklyInventory,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>달력 선택</CardTitle>
            <CardDescription>날짜를 선택하면 해당 주간의 재고 현황을 보여줍니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onDateSelect}
              className="rounded-md border"
              modifiers={{
                selectedWeek: (date) => date >= selectedWeekRange.start && date <= selectedWeekRange.end
              }}
              modifiersClassNames={{
                selectedWeek: 'bg-blue-100 text-blue-900 font-medium' // Explicit styling for visibility
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>주간 재고 현황</CardTitle>
            <CardDescription>매주 초기화되는 재고 시스템 (화-일 대여, 월요일 반납)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="font-semibold text-blue-800 mb-2">선택된 주간</div>
                <div className="text-lg font-bold text-blue-600">
                  {`${selectedWeekRange.start.getFullYear()}년 ${selectedWeekRange.start.getMonth() + 1}월 ${selectedWeekRange.start.getDate()}일 ~ ${selectedWeekRange.end.getMonth() + 1}월 ${selectedWeekRange.end.getDate()}일`}
                </div>
                <div className="text-sm text-blue-500 mt-1">
                  매주 초기화되는 재고 시스템 (화-일 대여, 월요일 반납)
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-gray-800 mb-3">마감된 디자인 리스트 (availability = 0)</h4>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  {weeklyInventorySoldOut.length === 0 ? (
                    <div className="text-gray-500 text-sm text-center py-2">
                      마감된 디자인이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {weeklyInventorySoldOut.map((item) => (
                        <div key={item.id} className="flex justify-between items-center bg-white rounded px-3 py-2 border border-red-100">
                          <div className="flex items-center space-x-3">
                            <span className="font-medium text-red-800">{item.design_name}</span>
                            <span className="text-sm text-red-600">({item.size})</span>
                          </div>
                          <div className="text-xs text-red-500">
                            총 {item.total_quantity}개 중 {item.weekRentals}개 대여중
                          </div>
                        </div>
                      ))}
                      <div className="text-xs text-red-600 mt-3 text-center">
                        총 {weeklyInventorySoldOut.length}개 디자인이 마감되었습니다.
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>주간 상세 재고 분석</CardTitle>
          <CardDescription>선택된 주간의 디자인+사이즈별 상세 재고 현황</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상품코드</TableHead>
                  <TableHead>디자인명</TableHead>
                  <TableHead>사이즈</TableHead>
                  <TableHead>총 수량</TableHead>
                  <TableHead>화-일 대여중</TableHead>
                  <TableHead>대여 가능</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(allWeeklyInventory || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.design_code}</TableCell>
                    <TableCell>{item.design_name}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell><Badge variant="outline">{item.total_quantity}개</Badge></TableCell>
                    <TableCell><Badge className="bg-orange-100 text-orange-800">{item.weekRentals}개</Badge></TableCell>
                    <TableCell><Badge className="bg-green-100 text-green-800 font-bold">{item.finalAvailable}개</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
