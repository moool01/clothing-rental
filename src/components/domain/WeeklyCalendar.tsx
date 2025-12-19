import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DesignSizeInventory, WeekRange } from '@/types';
import { cn } from "@/lib/utils";

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
            <Card className="h-full">
            <CardHeader>
                <CardTitle>달력</CardTitle>
                <CardDescription>월-일 주간 선택</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
                <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onDateSelect}
                className="rounded-md border shadow-sm"
                modifiers={{
                    selectedWeek: (date) => date >= selectedWeekRange.start && date <= selectedWeekRange.end
                }}
                modifiersClassNames={{
                    selectedWeek: 'bg-blue-200 text-blue-900 font-bold rounded-sm'
                }}
                />
            </CardContent>
            </Card>
        </div>

        <div className="md:col-span-3">
            <Card className="h-full">
            <CardHeader>
                <CardTitle>주간 재고 현황</CardTitle>
                <CardDescription>
                     {`${selectedWeekRange.start.getFullYear()}년 ${selectedWeekRange.start.getMonth() + 1}월 ${selectedWeekRange.start.getDate()}일 ~ ${selectedWeekRange.end.getMonth() + 1}월 ${selectedWeekRange.end.getDate()}일`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-6 h-full">
                    {/* Selected Week Summary (1/2 width relative to container or smaller based on visual weight) */}
                    <div className="md:w-1/3 flex flex-col justify-center items-center p-6 bg-blue-50 rounded-xl border border-blue-100 shadow-sm text-center">
                        <div className="text-sm font-medium text-blue-800 uppercase tracking-wide mb-2">Selected Week</div>
                        <div className="text-2xl font-bold text-blue-700">
                             Week {Math.ceil(selectedWeekRange.start.getDate() / 7)}
                        </div>
                        <div className="mt-4 text-xs text-blue-600 bg-white px-3 py-1 rounded-full shadow-sm">
                            {selectedWeekRange.start.toLocaleDateString()} - {selectedWeekRange.end.toLocaleDateString()}
                        </div>
                    </div>

                    {/* Sold Out List (Larger Area) */}
                    <div className="md:w-2/3 flex flex-col">
                        <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-red-500"></span>
                             마감된 디자인 리스트
                        </h4>
                        <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-4 overflow-y-auto max-h-[300px]">
                        {weeklyInventorySoldOut.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                            마감된 디자인이 없습니다.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {weeklyInventorySoldOut.map((item) => (
                                <div key={item.id} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 shadow-sm border border-red-100">
                                <div className="flex items-center space-x-2 truncate">
                                    <span className="font-medium text-gray-900 truncate">{item.design_name}</span>
                                    <Badge variant="secondary" className="text-xs">{item.size}</Badge>
                                </div>
                                <div className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                                    Sold Out
                                </div>
                                </div>
                            ))}
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </CardContent>
            </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>주간 상세 재고 분석</CardTitle>
          <CardDescription>선택된 주간의 디자인 + 사이즈별 상세 재고 현황</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="font-semibold">상품코드</TableHead>
                  <TableHead className="font-semibold">디자인명</TableHead>
                  <TableHead className="font-semibold">사이즈</TableHead>
                  <TableHead className="font-semibold text-center">총 수량</TableHead>
                  <TableHead className="font-semibold text-center">주간 예약/대여중</TableHead>
                  <TableHead className="font-semibold text-center">대여 가능</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(allWeeklyInventory || []).map((item) => (
                  <TableRow key={item.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-700">{item.design_code}</TableCell>
                    <TableCell className="font-medium">{item.design_name}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className="bg-gray-50">{item.size}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                         <span className="font-mono font-medium">{item.total_quantity}</span>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge className={cn(
                            "font-mono",
                            item.weekRentals && item.weekRentals > 0 ? "bg-orange-100 text-orange-800 hover:bg-orange-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}>
                            {item.weekRentals}개
                        </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge className={cn(
                            "font-mono",
                            item.finalAvailable && item.finalAvailable > 0 ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"
                        )}>
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
