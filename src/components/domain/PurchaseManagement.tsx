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

    // ✅ 추가: 수령 / 반납 방법 (기존 유지)
    pickup_method: '픽업',
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

  // ✅ date-only 비교 헬퍼 (TZ 꼬임 방지)
  const toDateOnly = (v?: string | null) => {
    if (!v) return '';
    const d = new Date(v);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // ✅ 필터 + 정렬 적용된 구매 목록
  const filteredPurchases = purchases
    .filter((p) => {
      const customerName = (p.customers?.name || '').toLowerCase();
      const customerMatch =
        !searchCustomer || customerName.includes(searchCustomer.toLowerCase());

      // expected_ship_date가 timestamptz일 수 있으니 date-only로 비교
      const shipDateOnly = toDateOnly(p.expected_ship_date as any);
      const shipmentDateMatch =
        !filterShipmentDate || shipDateOnly === filterShipmentDate;

      return customerMatch && shipmentDateMatch;
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];

      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;

      const aTime = new Date(aVal).getTime();
      const bTime = new Date(bVal).getTime();

      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });

  /**
   * ✅ 핵심 수정:
   * - 구매 insert 후 생성된 row를 받아오고
   * - pickup_method가 퀵/택배면 shipments에 자동 생성
   * - shipments.purchase_id로 연결
   */
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

      // (선택) 구매일을 timestamptz로 저장하고 싶으면 +09 붙여서 저장
      // DB가 date 타입이면 그냥 'YYYY-MM-DD' 그대로 넣는게 더 안전
      const purchasePayload: any = {
        customer_id: newPurchase.customer_id,
        design_code: newPurchase.design_code,
        design_name: newPurchase.design_name,
        size: newPurchase.size,
        quantity: Number(newPurchase.quantity) || 1,
        purchase_date: newPurchase.purchase_date, // DB가 date면 그대로
        purchase_price: Number(newPurchase.purchase_price) || 0,
        pickup_method: newPurchase.pickup_method,
        company_id: COMPANY_ID,

        // status 컬럼이 있으면 기본값 세팅 추천
        status: '구매완료',
      };

      // ✅ 1) purchases INSERT + 생성 row 받기
      const { data: created, error: purchaseErr } = await supabase
        .from('purchases')
        .insert([purchasePayload])
        .select('*, customers(*)')
        .single();

      if (purchaseErr) throw purchaseErr;
      if (!created?.id) throw new Error('구매 생성 결과가 없습니다.');

      // ✅ 2) 퀵/택배면 shipments 자동 생성 (purchase_id로 연결)
      const method = (newPurchase.pickup_method || '').trim();
      const needsShipment = method === '퀵' || method === '택배';

      if (needsShipment) {
        // shipment_date / expected_ship_date가 있으면 그걸 쓰고,
        // 없으면 purchase_date를 사용 (일단 이렇게)
        const shipmentPayload: any = {
          purchase_id: created.id,                 // ✅ 연결 키
          customer_id: created.customer_id,
          design_code: created.design_code,
          design_name: created.design_name,
          size: created.size,
          quantity: created.quantity,
          company_id: COMPANY_ID,

          status: '출고대기',

          // ✅ 너 shipments 스키마에 맞춰 컬럼명 확인 필요:
          // shipping_method / delivery_method 중 하나일 수 있음
          shipping_method: method,

          // 날짜 컬럼이 shipment_date면 이렇게:
          shipment_date: created.expected_ship_date || created.purchase_date,
        };

        const { error: shipErr } = await supabase
          .from('shipments')
          .insert([shipmentPayload]);

        if (shipErr) throw shipErr;
      }

      // UI reset
      setIsPurchaseDialogOpen(false);
      setNewPurchase({
        customer_id: '',
        design_code: '',
        design_name: '',
        size: '',
        quantity: 1,
        purchase_date: '',
        purchase_price: 0,
        pickup_method: '픽업',
      });

      setTimeout(fetchData, 150);

      toast({
        title: '구매 등록 완료',
        description: needsShipment ? '구매 + 출고가 자동 생성되었습니다.' : '구매가 등록되었습니다.',
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
                  새로운 구매를 등록합니다 (퀵/택배는 출고 자동 생성)
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

                {/* ✅ 수령 / 반납 방법 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>수령 방법 (퀵/택배면 출고 자동 생성)</Label>
                    <Select
                      value={newPurchase.pickup_method}
                      onValueChange={(v) =>
                        setNewPurchase({ ...newPurchase, pickup_method: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="수령 방법 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="픽업">픽업</SelectItem>
                        <SelectItem value="퀵">퀵</SelectItem>
                        <SelectItem value="택배">택배</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPurchaseDialogOpen(false)}
                >취소</Button>
                <Button onClick={addPurchase}>등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>디자인명</TableHead>
                <TableHead>사이즈</TableHead>
                <TableHead>수량</TableHead>
                <TableHead>고객명</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => toggleSort('purchase_date')}
                >
                  구매일
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => toggleSort('expected_ship_date')}
                >
                  출고 예정일
                </TableHead>

                <TableHead>수령방법</TableHead>

                <TableHead>구매가</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredPurchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.design_name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.size}</Badge></TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell>{p.customers?.name}</TableCell>
                  <TableCell>{toDateOnly(p.purchase_date as any) || '-'}</TableCell>
                  <TableCell>{toDateOnly(p.expected_ship_date as any) || '-'}</TableCell>

                  <TableCell>
                    <Badge variant="outline">{(p as any).pickup_method || '-'}</Badge>
                  </TableCell>

                  <TableCell>
                    {(p.purchase_price || 0).toLocaleString()}원
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePurchase(p.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
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