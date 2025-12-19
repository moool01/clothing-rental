import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DesignSizeInventory, WeekRange } from '@/types';

interface WeeklyCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date | undefined) => void;
  selectedWeekRange: WeekRange;
  weeklyInventorySoldOut: DesignSizeInventory[];
  allWeeklyInventory: DesignSizeInventory[];
}

const SOLD_OUT_PAGE_SIZE = 5;

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  selectedDate,
  onDateSelect,
  selectedWeekRange,
  weeklyInventorySoldOut,
  allWeeklyInventory,
}) => {
  const [soldOutPage, setSoldOutPage] = useState(0);

  const totalPages = Math.ceil(weeklyInventorySoldOut.length / SOLD_OUT_PAGE_SIZE);
  const pagedSoldOut = weeklyInventorySoldOut.slice(
    soldOutPage * SOLD_OUT_PAGE_SIZE,
    (soldOutPage + 1) * SOLD_OUT_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      {/* 상단 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 달력 */}
        <Card>
          <CardHeader>
            <CardTitle>달력 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onDateSelect}
              className="rounded-md border"
              modifiers={{
                selectedWeek: (date) =>
                  date >= selectedWeekRange.start && date <= selectedWeekRange.end,
              }}
              modifiersClassNames={{
                selectedWeek: 'bg-blue-100 text-blue-900 font-medium',
              }}
            />
          </CardContent>
        </Card>

        {/* 주간 재고 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>주간 재고 현황</CardTitle>
          </CardHeader>

          {/* 간격 최소화 */}
          <CardContent className="space-y-2">
            {/* 선택된 주간 (압축 상태바) */}
            <div className="px-3 py-1.5 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800">
                  선택된 주간
                </span>
                <span className="text-xs text-blue-500">
                  화–일 대여 · 월요일 반납
                </span>
              </div>

              <div className="text-xs font-semibold text-blue-700 mt-0.5">
                {`${selectedWeekRange.start.getFullYear()}년 ${
                  selectedWeekRange.start.getMonth() + 1
                }월 ${selectedWeekRange.start.getDate()}일 ~ ${
                  selectedWeekRange.end.getMonth() + 1
                }월 ${selectedWeekRange.end.getDate()}일`}
              </div>
            </div>

            {/* 마감된 디자인 리스트 */}
            <div className="pt-3">
              <h4 className="font-medium text-gray-900 mb-3">
                마감된 디자인 리스트
              </h4>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                {pagedSoldOut.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-4">
                    마감된 디자인이 없습니다.
                  </div>
                ) : (
                  pagedSoldOut.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-white rounded px-3 py-2 border border-red-100 text-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-red-800">
                          {item.design_name}
                        </span>
                        <span className="text-xs text-red-600">
                          ({item.size})
                        </span>
                      </div>
                      <div className="text-xs text-red-500">
                        {item.weekRentals}/{item.total_quantity}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={soldOutPage === 0}
                    onClick={() => setSoldOutPage((p) => p - 1)}
                  >
                    이전
                  </Button>

                  <span className="text-xs text-gray-600">
                    {soldOutPage + 1} / {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={soldOutPage === totalPages - 1}
                    onClick={() => setSoldOutPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 하단 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>주간 상세 재고 분석</CardTitle>
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
                  <TableHead>주간 예약/대여중</TableHead>
                  <TableHead>대여 가능</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(allWeeklyInventory || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.design_code}</TableCell>
                    <TableCell>{item.design_name}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.total_quantity}개
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-orange-100 text-orange-800">
                        {item.weekRentals}개
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 font-bold">
                        {item.finalAvailable}개
                      </Badge>
                    </TableCell>
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
// ㅜㅜ