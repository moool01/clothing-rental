import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { Customer, Rental } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import EditableCell from '@/components/EditableCell';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface CustomerManagementProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  rentals: Rental[];
  fetchData: () => Promise<void>;
  COMPANY_ID: string;
}

export const CustomerManagement: React.FC<CustomerManagementProps> = ({
  customers,
  setCustomers,
  rentals,
  fetchData,
  COMPANY_ID,
}) => {
  const { toast } = useToast();
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    deposit_account: '',
    emergency_contact: ''
  });

  const addCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...newCustomer, company_id: COMPANY_ID }])
        .select();

      if (error) throw error;

      setCustomers(prev => [...prev, data?.[0]]);
      setNewCustomer({ name: '', phone: '', address: '', deposit_account: '', emergency_contact: '' });
      setIsCustomerDialogOpen(false);

      toast({ title: '고객 추가 완료', description: '새 고객이 추가되었습니다.' });
    } catch (e: any) {
      toast({ title: '고객 추가 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const updateCustomer = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase.from('customers').update({ [field]: value }).eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '수정 완료', description: '고객 정보가 수정되었습니다.' });
    } catch (e: any) {
      toast({ title: '수정 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const active = rentals.filter(r => r.customer_id === id && r.status === '대여중');
      if (active.length > 0) {
        toast({ title: '삭제 불가', description: `대여중 ${active.length}건이 있어 삭제할 수 없습니다.`, variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;

      await fetchData();
      toast({ title: '삭제 완료', description: '고객이 삭제되었습니다.' });
    } catch (e: any) {
      toast({ title: '삭제 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>고객 관리</CardTitle>
            <CardDescription>고객 정보를 관리합니다</CardDescription>
          </div>

          <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />고객 추가</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 고객 추가</DialogTitle>
                <DialogDescription>새로운 고객을 등록합니다</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>이름</Label>
                  <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                </div>
                <div>
                  <Label>전화번호</Label>
                  <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                </div>
                {/* Email Removed */}
                <div>
                  <Label>주소</Label>
                  <Input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
                </div>
                <div>
                  <Label>보증금 환급 계좌</Label>
                  <Input value={newCustomer.deposit_account} onChange={(e) => setNewCustomer({ ...newCustomer, deposit_account: e.target.value })} />
                </div>
                <div>
                  <Label>비상 연락처</Label>
                  <Input value={newCustomer.emergency_contact} onChange={(e) => setNewCustomer({ ...newCustomer, emergency_contact: e.target.value })} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCustomerDialogOpen(false)}>취소</Button>
                <Button onClick={addCustomer}>추가</Button>
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
                <TableHead>이름</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>주소</TableHead>
                <TableHead>환급 계좌</TableHead>
                <TableHead>비상 연락처</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {customers.map((c) => {
                const active = rentals.filter(r => r.customer_id === c.id && r.status === '대여중');
                return (
                  <TableRow key={c.id}>
                    <TableCell><EditableCell value={c.name} type="text" onSave={(v) => updateCustomer(c.id, 'name', v)} /></TableCell>
                    <TableCell><EditableCell value={c.phone} type="text" onSave={(v) => updateCustomer(c.id, 'phone', v)} /></TableCell>
                    <TableCell><EditableCell value={c.address || ''} type="text" onSave={(v) => updateCustomer(c.id, 'address', v)} /></TableCell>
                    <TableCell><EditableCell value={c.deposit_account || ''} type="text" onSave={(v) => updateCustomer(c.id, 'deposit_account', v)} /></TableCell>
                    <TableCell><EditableCell value={c.emergency_contact || ''} type="text" onSave={(v) => updateCustomer(c.id, 'emergency_contact', v)} /></TableCell>
                    <TableCell>
                      {active.length > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-blue-100 text-blue-800">대여중 ({active.length})</Badge>
                          <span className="text-xs text-gray-500">삭제불가</span>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => deleteCustomer(c.id)} className="text-red-600 hover:text-red-800">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
