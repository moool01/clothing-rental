import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { Customer, DesignSizeInventory, Shipment } from '@/types';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import EditableCell from '@/components/EditableCell';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ShipmentManagementProps {
  shipments: Shipment[];
  customers: Customer[];
  inventory: DesignSizeInventory[];
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [newShipment, setNewShipment] = useState({
    customer_id: '',
    design_code: '',
    design_name: '',
    size: '',
    quantity: 1,
    shipment_date: new Date().toISOString().split('T')[0],
    shipping_method: '택배',
    status: '출고완료',
    notes: '', // 송장번호
  });

  const purchaseRows = inventory.filter(x => x.inventory_type === '구매용');

  const sortedShipments = [...shipments].sort((a, b) => {
    const aTime = new Date(a.shipment_date).getTime();
    const bTime = new Date(b.shipment_date).getTime();
    return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
  });

  const addShipment = async () => {
    try {
      if (!newShipment.customer_id || !newShipment.design_code || !newShipment.size) {
        toast({
          title: '입력 오류',
          description: '필수 항목을 입력해주세요.',
          variant: 'destructive',
        });
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
        notes: '',
      });

      setTimeout(fetchData, 120);
      toast({ title: '출고 등록 완료' });
    } catch (e: any) {
      toast({
        title: '출고 등록 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    }
  };

  const deleteShipment = async (id: string) => {
    try {
      const { error } = await supabase.from('shipments').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '출고 삭제 완료' });
    } catch (e: any) {
      toast({
        title: '출고 삭제 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    }
  };

  const updateShipment = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '출고 수정 완료' });
    } catch (e: any) {
      toast({
        title: '출고 수정 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    }
  };

  const exportToExcel = () => {
    const dataToExport = shipments.map(s => ({
      상품코드: s.design_code,
      디자인명: s.design_name,
      사이즈: s.size,
      수량: s.quantity,
      고객명: s.customers?.name || '',
      출고일: s.shipment_date,
      배송방법: s.shipping_method,
      송장번호: s.notes || '',
      상태: s.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '출고현황');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `출고현황_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-green-600">출고 관리</CardTitle>
            <CardDescription>구매용 상품 출고 관리</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" /> 엑셀 다운로드
            </Button>
            <Button onClick={() => setIsShipmentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> 출고 등록
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>상품코드</TableHead>
              <TableHead>디자인명</TableHead>
              <TableHead>사이즈</TableHead>
              <TableHead>수량</TableHead>
              <TableHead>고객명</TableHead>
              <TableHead
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="cursor-pointer"
              >
                출고일 {sortOrder === 'asc' ? '▲' : '▼'}
              </TableHead>
              <TableHead>배송방법</TableHead>
              <TableHead>송장번호</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>액션</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedShipments.map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  <EditableCell
                    type="text"
                    value={s.design_code}
                    onSave={v => updateShipment(s.id, 'design_code', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    type="text"
                    value={s.design_name}
                    onSave={v => updateShipment(s.id, 'design_name', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    type="text"
                    value={s.size}
                    onSave={v => updateShipment(s.id, 'size', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    type="number"
                    value={s.quantity}
                    onSave={v => updateShipment(s.id, 'quantity', Number(v))}
                  />
                </TableCell>
                <TableCell>{s.customers?.name || '-'}</TableCell>
                <TableCell>
                  <EditableCell
                    type="date"
                    value={s.shipment_date}
                    onSave={v => updateShipment(s.id, 'shipment_date', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    type="select"
                    value={s.shipping_method}
                    options={['픽업', '퀵', '택배']}
                    onSave={v => updateShipment(s.id, 'shipping_method', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    type="text"
                    value={s.notes || ''}
                    placeholder="송장번호"
                    onSave={v => updateShipment(s.id, 'notes', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    type="select"
                    value={s.status}
                    options={['출고대기', '출고완료', '배송중', '배송완료']}
                    onSave={v => updateShipment(s.id, 'status', v)}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => deleteShipment(s.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isShipmentDialogOpen} onOpenChange={setIsShipmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출고 등록</DialogTitle>
            <DialogDescription>구매용 상품 출고 등록</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Label>송장번호</Label>
            <Input
              placeholder="송장번호 입력"
              value={newShipment.notes}
              onChange={e => setNewShipment({ ...newShipment, notes: e.target.value })}
            />
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