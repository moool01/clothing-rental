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
    rental_date: '', return_due_date: '', rental_price: 0
  });

  // Sorting state
  const [sortField, setSortField] = useState<keyof Rental>('rental_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const addRental = async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .insert([{
          ...newRental,
          status: '대여중',
          company_id: COMPANY_ID,
        }])
        .select(`*, customers(*)`);

      if (error) throw error;

      setRentals(prev => [data?.[0], ...prev]);
      setNewRental({ customer_id: '', design_code: '', design_name: '', size: '', quantity: 1, rental_date: '', return_due_date: '', rental_price: 0 });
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
      const { error } = await supabase.from('rentals').update({ [field]: value }).eq('id', id);
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

  const handleSort = (field: keyof Rental) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRentals = [...rentals].sort((a, b) => {
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
        // fallback
        comparison = String(aValue).localeCompare(String(bValue));
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>대여 관리</CardTitle>
            <CardDescription>의류 대여 현황을 관리합니다</CardDescription>
          </div>

          <div className="flex gap-2">
            {/* Sort Controls could go here, but column headers are clickable */}
            <Dialog open={isRentalDialogOpen} onOpenChange={setIsRentalDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setNewRental({ customer_id: '', design_code: '', design_name: '', size: '', quantity: 1, rental_date: '', return_due_date: '', rental_price: 0 });
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
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>고객명</TableHead>
                <TableHead>디자인명</TableHead>
                <TableHead>사이즈</TableHead>
                <TableHead>수량</TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('rental_date')}>
                  대여일 {sortField === 'rental_date' && (sortDirection === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                </TableHead>
                <TableHead>반납예정일</TableHead>
                <TableHead>대여료</TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('delivery_method')}>
                    배송방법 {sortField === 'delivery_method' && (sortDirection === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                </TableHead>
                <TableHead>상태</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRentals.map((r) => (
                <TableRow key={r.id}>
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
                    <EditableCell value={r.delivery_method || ''} type="select" options={['택배', '퀵', '직접수령']} placeholder="선택"
                      onSave={(v) => updateRental(r.id, 'delivery_method', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={r.status} type="select" options={['대여예정', '출고완료', '대여중', '반납완료', '연체']}
                      onSave={(v) => updateRental(r.id, 'status', v)} />
                  </TableCell>
                  <TableCell>
                    {r.status === '반납완료' && (
                      <Button variant="ghost" size="sm" onClick={() => deleteRental(r.id)} className="text-red-600 hover:text-red-800">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
