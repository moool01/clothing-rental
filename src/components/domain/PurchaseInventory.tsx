import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { useAuth } from '@/contexts/AuthContext';
import { DesignSizeInventory } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableTableRow } from '@/components/SortableTableRow';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface PurchaseInventoryProps {
  inventory: DesignSizeInventory[];
  setInventory: React.Dispatch<React.SetStateAction<DesignSizeInventory[]>>;
  fetchData: () => Promise<void>;
  COMPANY_ID: string;
}

export const PurchaseInventory: React.FC<PurchaseInventoryProps> = ({
  inventory,
  setInventory,
  fetchData,
  COMPANY_ID,
}) => {
  const { role } = useAuth();
  const { toast } = useToast();

  const [isDesignDialogOpen, setIsDesignDialogOpen] = useState(false);

  const [newDesignSize, setNewDesignSize] = useState({
    design_code: '',
    design_name: '',
    size: '',
    rental_price: 0,
    total_quantity: 0,
    inventory_type: '구매용',
  });

  // ✅ 디자인명 검색 state
  const [searchDesignName, setSearchDesignName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canEdit = role === 'manager' || role === 'admin';

  // ✅ 디자인명 검색 포함된 구매용 재고
  const purchaseRows = inventory.filter(x =>
    x.inventory_type === '구매용' &&
    (
      searchDesignName === '' ||
      x.design_name.toLowerCase().includes(searchDesignName.toLowerCase())
    )
  );

  const addDesignSize = async () => {
    try {
      const { data, error } = await supabase
        .from('design_size_inventory')
        .insert([{
          ...newDesignSize,
          rented_quantity: 0,
          company_id: COMPANY_ID,
        }])
        .select();

      if (error) throw error;

      setInventory(prev => [...prev, data?.[0]]);
      setNewDesignSize({
        design_code: '',
        design_name: '',
        size: '',
        rental_price: 0,
        total_quantity: 0,
        inventory_type: '구매용',
      });
      setIsDesignDialogOpen(false);

      toast({
        title: '재고 추가 완료',
        description: '새 디자인+사이즈가 추가되었습니다.',
      });
    } catch (e: any) {
      toast({
        title: '재고 추가 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    }
  };

  const updateDesignSize = async (id: string, field: string, value: any) => {
    if (!canEdit) return;

    try {
      // 1) DB 업데이트 (구매용만)
      const { error } = await supabase
        .from('design_size_inventory')
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('inventory_type', '구매용'); // ✅ 구매용만 업데이트(실수 방지)

      if (error) throw error;

      // 2) ✅ 화면 즉시 반영 (이게 체감상 “안 바뀜”을 없앰)
      setInventory(prev =>
        prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
      );

      // 3) 필요하면 서버 정합성 맞추기 위해 나중에 fetch
      // (즉시 fetchData()를 하면 타이밍 이슈로 다시 0으로 보일 수 있어서 살짝 딜레이)
      setTimeout(fetchData, 150);

      toast({ title: '수정 완료', description: '데이터가 수정되었습니다.' });
    } catch (e: any) {
      toast({
        title: '수정 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    }
  };

  const deleteDesignSize = async (id: string) => {
    if (!canEdit) return;
    try {
      const { error } = await supabase
        .from('design_size_inventory')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '삭제 완료', description: '삭제되었습니다.' });
    } catch (e: any) {
      toast({ title: '삭제 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const handleDragEndPurchase = async (event: DragEndEvent) => {
    if (!canEdit) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = inventory.findIndex(x => x.id === active.id);
    const newIndex = inventory.findIndex(x => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newInventory = arrayMove(inventory, oldIndex, newIndex);
    setInventory(newInventory);

    const purchaseItems = newInventory.filter(x => x.inventory_type === '구매용');
    const updates = purchaseItems.map((x, idx) => ({
      id: x.id,
      display_order: idx,
    }));

    for (const u of updates) {
      await supabase
        .from('design_size_inventory')
        .update({ display_order: u.display_order })
        .eq('id', u.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-purple-600">구매용 재고 관리</CardTitle>
            <CardDescription>판매 비즈니스용 재고를 관리합니다</CardDescription>
          </div>

          {canEdit && (
            <Button
              onClick={() => {
                setNewDesignSize({ ...newDesignSize, inventory_type: '구매용' });
                setIsDesignDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              구매용 재고 추가
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* ✅ 디자인명 검색 */}
        <div className="mb-4">
          <Input
            placeholder="디자인명 검색"
            value={searchDesignName}
            onChange={(e) => setSearchDesignName(e.target.value)}
            className="w-[260px]"
          />
        </div>

        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEndPurchase}
            modifiers={[restrictToVerticalAxis]}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>상품코드</TableHead>
                  <TableHead>디자인명</TableHead>
                  <TableHead>사이즈</TableHead>
                  <TableHead>판매가</TableHead>
                  <TableHead>총 수량</TableHead>
                  <TableHead>판매됨</TableHead>
                  <TableHead>구매가능수량</TableHead>
                  <TableHead>주문필요량</TableHead>
                  {canEdit && <TableHead>삭제</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                <SortableContext
                  items={purchaseRows.map(x => x.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {purchaseRows.map((design) => (
                    <SortableTableRow
                      key={design.id}
                      id={design.id}
                      design={design}
                      onUpdate={updateDesignSize}
                      onDelete={deleteDesignSize}
                      inventoryType="purchase"
                      readonly={!canEdit}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </CardContent>

      <Dialog open={isDesignDialogOpen} onOpenChange={setIsDesignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 디자인+사이즈 추가</DialogTitle>
            <DialogDescription>새로운 디자인+사이즈 조합을 등록합니다</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>디자인 코드</Label>
              <Input
                value={newDesignSize.design_code}
                onChange={(e) =>
                  setNewDesignSize({ ...newDesignSize, design_code: e.target.value })
                }
              />
            </div>
            <div>
              <Label>디자인명</Label>
              <Input
                value={newDesignSize.design_name}
                onChange={(e) =>
                  setNewDesignSize({ ...newDesignSize, design_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>사이즈</Label>
              <Input
                value={newDesignSize.size}
                onChange={(e) =>
                  setNewDesignSize({ ...newDesignSize, size: e.target.value })
                }
              />
            </div>
            <div>
              <Label>판매가</Label>
              <Input
                type="number"
                value={newDesignSize.rental_price}
                onChange={(e) =>
                  setNewDesignSize({ ...newDesignSize, rental_price: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>총 수량</Label>
              <Input
                type="number"
                value={newDesignSize.total_quantity}
                onChange={(e) =>
                  setNewDesignSize({ ...newDesignSize, total_quantity: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>재고 타입</Label>
              <Select
                value={newDesignSize.inventory_type}
                onValueChange={(v) =>
                  setNewDesignSize({ ...newDesignSize, inventory_type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="대여용">대여용</SelectItem>
                  <SelectItem value="구매용">구매용</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDesignDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={addDesignSize}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
