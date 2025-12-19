import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { useAuth } from '@/contexts/AuthContext';
import { Customer, DesignSizeInventory, Rental } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import EditableCell from '@/components/EditableCell';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface RentalManagementProps {
  rentals: Rental[];
  setRentals: React.Dispatch<React.SetStateAction<Rental[]>>;
  customers: Customer[];
  designSizeInventory: DesignSizeInventory[];
  fetchData: () => Promise<void>;
  rentalWeeklyInventory: DesignSizeInventory[];
  setRentalWeeklyInventory: React.Dispatch<React.SetStateAction<DesignSizeInventory[]>>;
  calculateRentalWeeklyInventory: (date: string) => void;
  COMPANY_ID: string;
}

export const RentalManagement: React.FC<RentalManagementProps> = ({
  rentals,
  setRentals,
  customers,
  designSizeInventory,
  fetchData,
  rentalWeeklyInventory,
  setRentalWeeklyInventory,
  calculateRentalWeeklyInventory,
  COMPANY_ID,
}) => {
  const { toast } = useToast();
  const [isRentalDialogOpen, setIsRentalDialogOpen] = useState(false);
  const [newRental, setNewRental] = useState({
    customer_id: '', design_code: '', design_name: '', size: '', quantity: 1,
    rental_date: '', return_due_date: '', rental_price: 0, shipping_method: '택배'
  });

  // Sorting state
  const [sortField, setSortField] = useState<keyof Rental>('rental_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [shippingFilter, setShippingFilter] = useState<string>('all');

  // Bulk Selection state
  const [selectedRentalIds, setSelectedRentalIds] = useState<Set<string>>(new Set());

  const addRental = async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .insert([{
          ...newRental,
          status: '대여예정', // Default as per typical flow
          company_id: COMPANY_ID,
        }])
        .select(`*, customers(*)`);

      if (error) throw error;

      setRentals(prev => [data?.[0], ...prev]);
      setNewRental({ customer_id: '', design_code: '', design_name: '', size: '', quantity: 1, rental_date: '', return_due_date: '', rental_price: 0, shipping_method: '택배' });
      setIsRentalDialogOpen(false);
      setRentalWeeklyInventory([]);

      setTimeout(fetchData, 120);

      toast({ title: '대여 등록 완료', description: '대여가 등록되었습니다.' });
    } catch (e: any) {
      toast({ title: '대여 등록 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const updateRental = async (id: string, field: string, value: any) => {
    try {
      // Handle the rename from delivery_method to shipping_method
      const dbField = field === 'delivery_method' ? 'shipping_method' : field;

      const { error } = await supabase.from('rentals').update({ [dbField]: value }).eq('id', id);
      if (error) throw error;

      if (field === 'status') setTimeout(fetchData, 120);
      else await fetchData();

      toast({ title: '수정 완료', description: '대여 정보가 수정되었습니다.' });
    } catch (e: any) {
      toast({ title: '수정 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const deleteRental = async (id: string) => {
    try {
      const { error } = await supabase.from('rentals').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '삭제 완료', description: '대여 기록이 삭제되었습니다.' });
    } catch (e: any) {
      toast({ title: '삭제 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  // Bulk Actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredRentals.map(r => r.id));
      setSelectedRentalIds(allIds);
    } else {
      setSelectedRentalIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRentalIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRentalIds(newSelected);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedRentalIds.size === 0) return;

    try {
      const ids = Array.from(selectedRentalIds);
      const { error } = await supabase
        .from('rentals')
        .update({ status: newStatus })
        .in('id', ids);

      if (error) throw error;

      await fetchData();
      setSelectedRentalIds(new Set()); // Clear selection
      toast({ title: '일괄 수정 완료', description: `${ids.length}건의 상태가 변경되었습니다.` });
    } catch (e: any) {
      toast({ title: '일괄 수정 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const handleSort = (field: keyof Rental) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredRentals = rentals.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesShipping = shippingFilter === 'all' || r.shipping_method === shippingFilter;
    const matchesSearch = searchQuery === '' ||
        r.customers?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.design_name.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (dateRange?.from) {
        const rentalDate = new Date(r.rental_date);
        const from = new Date(dateRange.from);
        from.setHours(0,0,0,0);
        rentalDate.setHours(0,0,0,0);

        if (dateRange.to) {
            const to = new Date(dateRange.to);
            to.setHours(23,59,59,999);
             matchesDate = rentalDate >= from && rentalDate <= to;
        } else {
             matchesDate = rentalDate.getTime() === from.getTime();
        }
    }

    return matchesStatus && matchesSearch && matchesDate && matchesShipping;
  });

  const sortedRentals = [...filteredRentals].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === bValue) return 0;

    // Handle null/undefined
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else {
        comparison = String(aValue).localeCompare(String(bValue));
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>대여 관리</CardTitle>
              <CardDescription>의류 대여 현황을 관리합니다</CardDescription>
            </div>

             <Dialog open={isRentalDialogOpen} onOpenChange={setIsRentalDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setNewRental({ customer_id: '', design_code: '', design_name: '', size: '', quantity: 1, rental_date: '', return_due_date: '', rental_price: 0, shipping_method: '택배' });
                  setRentalWeeklyInventory([]);
                }}>
                  <Plus className="h-4 w-4 mr-2" />대여 등록
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 대여 등록</DialogTitle>
                  <DialogDescription>새로운 대여를 등록합니다</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>고객</Label>
                    <Select value={newRental.customer_id} onValueChange={(v) => setNewRental({ ...newRental, customer_id: v })}>
                      <SelectTrigger><SelectValue placeholder="고객 선택" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>대여일</Label>
                    <Input
                      type="date"
                      value={newRental.rental_date}
                      onChange={(e) => {
                        const d = e.target.value;
                        setNewRental({ ...newRental, rental_date: d, design_code: '', design_name: '', size: '', rental_price: 0 });
                        calculateRentalWeeklyInventory(d);
                      }}
                    />
                  </div>

                  <div>
                    <Label>반납예정일</Label>
                    <Input
                      type="date"
                      value={newRental.return_due_date}
                      onChange={(e) => setNewRental({ ...newRental, return_due_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>배송방법</Label>
                    <Select value={newRental.shipping_method} onValueChange={(v) => setNewRental({ ...newRental, shipping_method: v })}>
                        <SelectTrigger><SelectValue placeholder="배송방법 선택" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="택배">택배</SelectItem>
                            <SelectItem value="퀵">퀵</SelectItem>
                            <SelectItem value="픽업">픽업</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>디자인+사이즈 (선택된 주간 대여가능)</Label>
                    {!newRental.rental_date ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        대여일을 먼저 선택해주세요.
                      </div>
                    ) : rentalWeeklyInventory.length === 0 ? (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                        선택된 주간에 대여 가능한 재고가 없습니다.
                      </div>
                    ) : (
                      <Select
                        value={newRental.design_code && newRental.size ? `${newRental.design_code}-${newRental.size}` : ''}
                        onValueChange={(value) => {
                          const [design_code, size] = value.split('-');
                          const found = rentalWeeklyInventory.find((x: any) => x.design_code === design_code && x.size === size);
                          setNewRental({
                            ...newRental,
                            design_code,
                            design_name: found?.design_name || '',
                            size,
                            rental_price: found?.rental_price || 0
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="대여 가능한 디자인+사이즈 선택" /></SelectTrigger>
                        <SelectContent>
                          {rentalWeeklyInventory.map((x: any) => (
                            <SelectItem key={`${x.design_code}-${x.size}`} value={`${x.design_code}-${x.size}`}>
                              {x.design_name} ({x.size}) - 대여가능: {x.finalAvailable}개
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <Label>대여 수량</Label>
                    <Input type="number" min="1" value={newRental.quantity}
                      onChange={(e) => setNewRental({ ...newRental, quantity: Number(e.target.value) })} />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRentalDialogOpen(false)}>취소</Button>
                  <Button onClick={addRental}>등록</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-lg border">
            <div className="flex items-center gap-2">
                 <Label className="text-xs">기간</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[240px] justify-start text-left font-normal h-8",
                            !dateRange && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                            <>
                                {format(dateRange.from, "yyyy-MM-dd")} -{" "}
                                {format(dateRange.to, "yyyy-MM-dd")}
                            </>
                            ) : (
                            format(dateRange.from, "yyyy-MM-dd")
                            )
                        ) : (
                            <span>대여일 선택</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex items-center gap-2">
                 <Label className="text-xs">상태</Label>
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[120px] h-8">
                        <SelectValue placeholder="상태 필터" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        <SelectItem value="대여예정">대여예정</SelectItem>
                        <SelectItem value="출고완료">출고완료</SelectItem>
                        <SelectItem value="대여중">대여중</SelectItem>
                        <SelectItem value="반납완료">반납완료</SelectItem>
                        <SelectItem value="연체">연체</SelectItem>
                    </SelectContent>
                 </Select>
            </div>

            <div className="flex items-center gap-2">
                <Label className="text-xs">배송</Label>
                <Select value={shippingFilter} onValueChange={setShippingFilter}>
                    <SelectTrigger className="w-[100px] h-8">
                        <SelectValue placeholder="배송 필터" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        <SelectItem value="택배">택배</SelectItem>
                        <SelectItem value="퀵">퀵</SelectItem>
                        <SelectItem value="픽업">픽업</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Input
                placeholder="고객명, 디자인명 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] h-8"
            />

            {selectedRentalIds.size > 0 && (
                <div className="ml-auto flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleBulkStatusChange('대여중')}>대여중 처리</Button>
                    <Button variant="secondary" size="sm" onClick={() => handleBulkStatusChange('반납완료')}>반납 처리</Button>
                </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]">
                    <Checkbox
                        checked={filteredRentals.length > 0 && selectedRentalIds.size === filteredRentals.length}
                        onCheckedChange={(checked: boolean) => handleSelectAll(checked)}
                    />
                </TableHead>
                <TableHead>고객명</TableHead>
                <TableHead>디자인명</TableHead>
                <TableHead>사이즈</TableHead>
                <TableHead>수량</TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('rental_date')}>
                  대여일 {sortField === 'rental_date' && (sortDirection === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                </TableHead>
                <TableHead>반납예정일</TableHead>
                <TableHead>대여료</TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('shipping_method')}>
                    배송방법 {sortField === 'shipping_method' && (sortDirection === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                </TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRentals.map((r) => (
                <TableRow key={r.id} className={selectedRentalIds.has(r.id) ? "bg-blue-50" : ""}>
                  <TableCell>
                    <Checkbox
                        checked={selectedRentalIds.has(r.id)}
                        onCheckedChange={(checked: boolean) => handleSelectOne(r.id, checked)}
                    />
                  </TableCell>
                  <TableCell>{r.customers?.name || '-'}</TableCell>
                  <TableCell>
                    <EditableCell value={r.design_name} type="text" onSave={(v) => updateRental(r.id, 'design_name', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.size} type="text" onSave={(v) => updateRental(r.id, 'size', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.quantity} type="number" onSave={(v) => updateRental(r.id, 'quantity', Number(v))} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.rental_date} type="date" onSave={(v) => updateRental(r.id, 'rental_date', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.return_due_date} type="date" onSave={(v) => updateRental(r.id, 'return_due_date', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.rental_price} type="number" onSave={(v) => updateRental(r.id, 'rental_price', Number(v))} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.shipping_method || ''} type="select" options={['택배', '퀵', '픽업']} placeholder="선택"
                      onSave={(v) => updateRental(r.id, 'shipping_method', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.status} type="select" options={['대여예정', '출고완료', '대여중', '반납완료', '연체']}
                      onSave={(v) => updateRental(r.id, 'status', v)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
