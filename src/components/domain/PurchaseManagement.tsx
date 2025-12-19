import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { Customer, DesignSizeInventory, Purchase } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface PurchaseManagementProps {
  purchases: Purchase[];
  customers: Customer[];
  inventory: DesignSizeInventory[];
  fetchData: () => Promise<void>;
  COMPANY_ID: string;
}

export const PurchaseManagement: React.FC<PurchaseManagementProps> = ({
  purchases,
  customers,
  inventory,
  fetchData,
  COMPANY_ID,
}) => {
  const { toast } = useToast();

  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);

  const [newPurchase, setNewPurchase] = useState({
    customer_id: '',
    design_code: '',
    design_name: '',
    size: '',
    quantity: 1,
    purchase_date: '',
    purchase_price: 0,
  });

  // 🔍 필터 상태
  const [searchCustomer, setSearchCustomer] = useState('');
  const [filterShipmentDate, setFilterShipmentDate] = useState('');

  // 🔃 정렬 상태 (기본 = 구매일 desc)
  const [sortKey, setSortKey] =
    useState<'purchase_date' | 'expected_ship_date'>('purchase_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const purchaseRows = inventory.filter(x => x.inventory_type === '구매용');

  const toggleSort = (key: 'purchase_date' | 'expected_ship_date') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // ✅ 필터 + 정렬 적용된 구매 목록
  const filteredPurchases = purchases
    .filter((p) => {
      const customerName = (p.customers?.name || '').toLowerCase();

      const customerMatch =
        !searchCustomer || customerName.includes(searchCustomer.toLowerCase());

      const shipmentDateMatch =
        !filterShipmentDate || p.expected_ship_date === filterShipmentDate;

      return customerMatch && shipmentDateMatch;
    })
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // ✅ 날짜 값 없는 경우 항상 맨 아래
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;

      const aTime = new Date(aVal).getTime();
      const bTime = new Date(bVal).getTime();

      return sortOrder === 'asc'
        ? aTime - bTime
        : bTime - aTime;
    });

  const addPurchase = async () => {
    try {
      if (!newPurchase.customer_id || !newPurchase.design_code || !newPurchase.purchase_date) {
        toast({
          title: '입력 오류',
          description: '필수 항목을 입력해주세요.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('purchases')
        .insert([{ ...newPurchase, company_id: COMPANY_ID }]);

      if (error) throw error;

      setIsPurchaseDialogOpen(false);
      setNewPurchase({
        customer_id: '',
        design_code: '',
        design_name: '',
        size: '',
        quantity: 1,
        purchase_date: '',
        purchase_price: 0,
      });

      setTimeout(fetchData, 120);

      toast({
        title: '구매 등록 완료',
        description: '구매가 등록되었습니다.',
      });
    } catch (e: any) {
      toast({
        title: '구매 등록 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    }
  };

  const deletePurchase = async (id: string) => {
    try {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchData();

      toast({
        title: '구매 삭제 완료',
        description: '구매 기록이 삭제되었습니다.',
      });
    } catch (e: any) {
      toast({
        title: '구매 삭제 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-purple-600">구매 관리</CardTitle>
            <CardDescription>
              구매용 재고의 구매 현황을 관리합니다
            </CardDescription>
          </div>

          <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                구매 등록
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 구매 등록</DialogTitle>
                <DialogDescription>
                  새로운 구매를 등록합니다
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>고객</Label>
                  <Select
                    value={newPurchase.customer_id}
                    onValueChange={(v) =>
                      setNewPurchase({ ...newPurchase, customer_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="고객을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>구매일</Label>
                  <Input
                    type="date"
                    value={newPurchase.purchase_date}
                    onChange={(e) =>
                      setNewPurchase({
                        ...newPurchase,
                        purchase_date: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>구매용 상품</Label>
                  <Select
                    value={
                      newPurchase.design_code && newPurchase.size
                        ? `${newPurchase.design_code}-${newPurchase.size}`
                        : ''
                    }
                    onValueChange={(value) => {
                      const found = purchaseRows.find(
                        x => `${x.design_code}-${x.size}` === value
                      );
                      if (!found) return;

                      setNewPurchase({
                        ...newPurchase,
                        design_code: found.design_code,
                        design_name: found.design_name,
                        size: found.size,
                        purchase_price: found.rental_price,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="구매용 상품을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {purchaseRows.map((x) => (
                        <SelectItem
                          key={x.id}
                          value={`${x.design_code}-${x.size}`}
                        >
                          {x.design_name} ({x.size})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>수량</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newPurchase.quantity}
                      onChange={(e) =>
                        setNewPurchase({
                          ...newPurchase,
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>구매가</Label>
                    <Input
                      type="number"
                      value={newPurchase.purchase_price}
                      onChange={(e) =>
                        setNewPurchase({
                          ...newPurchase,
                          purchase_price: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPurchaseDialogOpen(false)}
                >
                  취소
                </Button>
                <Button onClick={addPurchase}>등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>고객명 검색</Label>
            <Input
              placeholder="고객명을 입력하세요"
              value={searchCustomer}
              onChange={(e) => setSearchCustomer(e.target.value)}
            />
          </div>

          <div>
            <Label>출고 예정일</Label>
            <Input
              type="date"
              value={filterShipmentDate}
              onChange={(e) => setFilterShipmentDate(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>디자인명</TableHead>
                <TableHead>사이즈</TableHead>
                <TableHead>수량</TableHead>
                <TableHead>고객명</TableHead>

                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('purchase_date')}
                >
                  구매일 {sortKey === 'purchase_date' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </TableHead>

                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('expected_ship_date')}
                >
                  출고 예정일 {sortKey === 'expected_ship_date' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </TableHead>

                <TableHead>구매가</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    구매 기록이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                filteredPurchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.design_name}</TableCell>
                    <TableCell><Badge variant="secondary">{p.size}</Badge></TableCell>
                    <TableCell>
                      <Badge className="bg-purple-100 text-purple-800">
                        {p.quantity}개
                      </Badge>
                    </TableCell>
                    <TableCell>{p.customers?.name || '-'}</TableCell>
                    <TableCell>{p.purchase_date}</TableCell>
                    <TableCell>{p.expected_ship_date || '-'}</TableCell>
                    <TableCell>
                      {(p.purchase_price || 0).toLocaleString()}원
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePurchase(p.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
