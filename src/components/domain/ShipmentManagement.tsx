import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { Customer, DesignSizeInventory, Shipment } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EditableCell from '@/components/EditableCell';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
// import { saveAs } from 'file-saver'; // Removing file-saver as we can use a simpler method if needed, but keeping import if environment supports it. If not, will implement manual download.
// The environment seems to have 'file-saver' in package.json, so it should be fine.
import { saveAs } from 'file-saver';


interface ShipmentManagementProps {
  shipments: Shipment[];
  customers: Customer[];
  inventory: DesignSizeInventory[]; // To select items for shipment
  fetchData: () => Promise<void>;
  COMPANY_ID: string;
}

export const ShipmentManagement: React.FC<ShipmentManagementProps> = ({
  shipments,
  customers,
  inventory,
  fetchData,
  COMPANY_ID,
}) => {
  const { toast } = useToast();
  const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false);
  const [newShipment, setNewShipment] = useState({
    customer_id: '',
    design_code: '',
    design_name: '',
    size: '',
    quantity: 1,
    shipment_date: new Date().toISOString().split('T')[0],
    // tracking_number removed from state/UI as requested
    shipping_method: '택배',
    status: '출고완료',
    notes: ''
  });

  const purchaseRows = inventory.filter(x => x.inventory_type === '구매용');

  const addShipment = async () => {
    try {
      if (!newShipment.customer_id || !newShipment.design_code || !newShipment.design_name || !newShipment.size || !newShipment.shipment_date) {
        toast({ title: '입력 오류', description: '필수 항목을 입력해주세요.', variant: 'destructive' });
        return;
      }
      if (!newShipment.quantity || newShipment.quantity <= 0) {
        toast({ title: '수량 오류', description: '수량은 1 이상이어야 합니다.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('shipments')
        .insert([{ ...newShipment, company_id: COMPANY_ID }]);

      if (error) throw error;

      setIsShipmentDialogOpen(false);
      setNewShipment({
        customer_id: '',
        design_code: '',
        design_name: '',
        size: '',
        quantity: 1,
        shipment_date: new Date().toISOString().split('T')[0],
        shipping_method: '택배',
        status: '출고완료',
        notes: ''
      });

      setTimeout(fetchData, 120);
      toast({ title: '출고 등록 완료', description: '출고가 등록되었습니다.' });
    } catch (e: any) {
      toast({ title: '출고 등록 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const deleteShipment = async (id: string) => {
    try {
      const { error } = await supabase.from('shipments').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '출고 삭제 완료', description: '출고 기록이 삭제되었습니다.' });
    } catch (e: any) {
      toast({ title: '출고 삭제 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const updateShipment = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase.from('shipments').update({ [field]: value }).eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '출고 수정 완료', description: '출고 정보가 수정되었습니다.' });
    } catch (e: any) {
      toast({ title: '출고 수정 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const exportToExcel = () => {
    try {
      // Data to export
      const dataToExport = shipments.map(s => ({
        '상품코드': s.design_code,
        '디자인명': s.design_name,
        '사이즈': s.size,
        '수량': s.quantity,
        '고객명': s.customers?.name || '',
        '출고일': s.shipment_date,
        '배송방법': s.shipping_method,
        '상태': s.status,
        '메모': s.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "출고현황");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });

      saveAs(data, `출고현황_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({ title: '엑셀 다운로드 완료', description: '파일이 다운로드 되었습니다.' });
    } catch (e) {
      console.error(e);
      toast({ title: '엑셀 다운로드 실패', description: '오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-green-600">출고 관리</CardTitle>
            <CardDescription>구매용 상품의 출고 및 배송을 관리합니다</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2"/>
                엑셀 다운로드
            </Button>
            <Button onClick={() => setIsShipmentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />출고 등록
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상품코드</TableHead>
                <TableHead>디자인명</TableHead>
                <TableHead>사이즈</TableHead>
                <TableHead>수량</TableHead>
                <TableHead>고객명</TableHead>
                <TableHead>출고일</TableHead>
                <TableHead>배송방법</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">출고 기록이 없습니다</TableCell>
                </TableRow>
              ) : shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <EditableCell value={s.design_code} type="text" onSave={(v) => updateShipment(s.id, 'design_code', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={s.design_name} type="text" onSave={(v) => updateShipment(s.id, 'design_name', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={s.size} type="text" onSave={(v) => updateShipment(s.id, 'size', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={s.quantity} type="number" onSave={(v) => updateShipment(s.id, 'quantity', Number(v))} />
                  </TableCell>
                  <TableCell>{s.customers?.name || '-'}</TableCell>
                  <TableCell>
                    <EditableCell value={s.shipment_date} type="date" onSave={(v) => updateShipment(s.id, 'shipment_date', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={s.shipping_method} type="select" options={['택배', '퀵', '픽업']}
                      onSave={(v) => updateShipment(s.id, 'shipping_method', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={s.status} type="select" options={['출고대기', '출고완료', '배송중', '배송완료']}
                      onSave={(v) => updateShipment(s.id, 'status', v)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => deleteShipment(s.id)} className="h-8 w-8 p-0 text-red-600 hover:text-red-800">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isShipmentDialogOpen} onOpenChange={setIsShipmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출고 등록</DialogTitle>
            <DialogDescription>구매용 상품의 출고를 등록합니다.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>고객</Label>
              <Select value={newShipment.customer_id} onValueChange={(v) => setNewShipment({ ...newShipment, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="고객을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>출고 상품</Label>
              <Select
                value={newShipment.design_code && newShipment.size ? `${newShipment.design_code}-${newShipment.size}` : ''}
                onValueChange={(value) => {
                  const found = purchaseRows.find(x => `${x.design_code}-${x.size}` === value);
                  if (!found) return;
                  setNewShipment({
                    ...newShipment,
                    design_code: found.design_code,
                    design_name: found.design_name,
                    size: found.size,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="출고할 상품을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {purchaseRows.map((x) => (
                    <SelectItem key={x.id} value={`${x.design_code}-${x.size}`}>
                      {x.design_name} ({x.size})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>수량</Label>
                <Input type="number" min="1" value={newShipment.quantity}
                  onChange={(e) => setNewShipment({ ...newShipment, quantity: Number(e.target.value) })} />
              </div>
              <div>
                <Label>출고일</Label>
                <Input type="date" value={newShipment.shipment_date}
                  onChange={(e) => setNewShipment({ ...newShipment, shipment_date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <Label>배송방법</Label>
                <Select value={newShipment.shipping_method} onValueChange={(v) => setNewShipment({ ...newShipment, shipping_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="택배">택배</SelectItem>
                    <SelectItem value="퀵">퀵</SelectItem>
                    <SelectItem value="픽업">픽업</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>상태</Label>
                <Select value={newShipment.status} onValueChange={(v) => setNewShipment({ ...newShipment, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="출고대기">출고대기</SelectItem>
                    <SelectItem value="출고완료">출고완료</SelectItem>
                    <SelectItem value="배송중">배송중</SelectItem>
                    <SelectItem value="배송완료">배송완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>메모</Label>
              <Input value={newShipment.notes} onChange={(e) => setNewShipment({ ...newShipment, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShipmentDialogOpen(false)}>취소</Button>
            <Button onClick={addShipment}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
