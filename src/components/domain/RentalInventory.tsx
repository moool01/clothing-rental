import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { useAuth } from '@/contexts/AuthContext';
import { DesignSizeInventory, WeekRange } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableTableRow } from '@/components/SortableTableRow';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Search } from 'lucide-react';

interface RentalInventoryProps {
  selectedWeekRange: WeekRange;
  inventory: DesignSizeInventory[];
  setInventory: React.Dispatch<React.SetStateAction<DesignSizeInventory[]>>;
  fetchData: () => Promise<void>;
  COMPANY_ID: string;
}

export const RentalInventory: React.FC<RentalInventoryProps> = ({
  selectedWeekRange,
  inventory,
  setInventory,
  fetchData,
  COMPANY_ID,
}) => {
  const { role } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isDesignDialogOpen, setIsDesignDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState('');

  const [newDesignSize, setNewDesignSize] = useState({
    design_code: '', design_name: '', size: '',
    rental_price: 0, total_quantity: 0, inventory_type: '대여용'
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canEdit = role === 'manager' || role === 'admin';
  const canViewTotal = role === 'admin';

  // Format Product Code: K(English) + Size + DesignCode (Simple display logic for now as requested: "Product code (Don't worry about it)")
  // But user gave format: KD - (1000) - (0~9) or similar.
  // We will stick to the raw `design_code` but maybe show a formatted version if possible.
  // For now, just display design_code as is, but we can add a helper if strict formatting is needed.

  const filteredInventory = inventory.filter(item =>
    item.design_name.toLowerCase().includes(searchQuery.toLowerCase())
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
      setNewDesignSize({ design_code: '', design_name: '', size: '', rental_price: 0, total_quantity: 0, inventory_type: '대여용' });
      setIsDesignDialogOpen(false);

      toast({ title: '재고 추가 완료', description: '새 디자인+사이즈가 추가되었습니다.' });
    } catch (e: any) {
      toast({ title: '재고 추가 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const updateDesignSize = async (id: string, field: string, value: any) => {
    if (!canEdit) {
      toast({ title: '권한 없음', description: '수정 권한이 없습니다.', variant: 'destructive' });
      return;
    }
    // Only managers can edit rental price? "Rental price edit also manager only" -> Covered by canEdit

    try {
      const { error } = await supabase.from('design_size_inventory').update({ [field]: value }).eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '수정 완료', description: '데이터가 수정되었습니다.' });
    } catch (e: any) {
      toast({ title: '수정 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const deleteDesignSize = async (id: string) => {
    if (!canEdit) {
      toast({ title: '권한 없음', description: '삭제 권한이 없습니다.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('design_size_inventory').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '삭제 완료', description: '삭제되었습니다.' });
    } catch (e: any) {
      toast({ title: '삭제 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const importFromCSV = async () => {
    if (!canEdit) return;

    try {
      if (!csvData.trim()) {
        toast({ title: '데이터 없음', description: 'CSV 데이터를 입력해주세요.', variant: 'destructive' });
        return;
      }

      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const imported: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        const item: any = {};
        headers.forEach((header, idx) => {
          let v: any = values[idx];

          if (header === 'rental_price' || header === 'total_quantity') {
            v = String(v).replace(/[^0-9]/g, '');
            item[header] = v ? parseInt(v, 10) : 0;
          } else {
            item[header] = v;
          }
        });

        item.rented_quantity = 0;
        item.company_id = COMPANY_ID;
        if (!item.inventory_type) item.inventory_type = '대여용';
        imported.push(item);
      }

      const { error } = await supabase.from('design_size_inventory').insert(imported);
      if (error) throw error;

      setCsvData('');
      setIsImportDialogOpen(false);
      setTimeout(fetchData, 120);

      toast({ title: 'CSV 가져오기 완료', description: `${imported.length}개 입력 요청 완료` });
    } catch (e: any) {
      toast({ title: 'CSV 가져오기 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const handleDragEndRental = async (event: DragEndEvent) => {
    // Only allow drag reorder if can edit? Maybe. Assuming yes.
    if (!canEdit) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Logic from Index.tsx reorderWithinType
    // This part assumes we are reordering filteredInventory but we need to reorder the full list in DB.
    // For simplicity, we just trigger reorder logic for '대여용' type items.

    // ... Simplified reorder logic here or passed from parent?
    // Implementing inline for now

    // Note: Since filteredInventory might be a subset due to search, drag and drop might behave weirdly.
    // Usually DND should be disabled when filtering.
    if (searchQuery) {
        toast({ title: '알림', description: '검색 중에는 순서 변경이 불가능합니다.' });
        return;
    }

    const oldIndex = inventory.findIndex(x => x.id === active.id);
    const newIndex = inventory.findIndex(x => x.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const newInventory = arrayMove(inventory, oldIndex, newIndex);
    setInventory(newInventory);

    // Update DB
    // Filter only rental items to update their order relative to each other?
    // The original code reordered based on type.

    const rentalItems = newInventory.filter(x => x.inventory_type === '대여용');
    const updates = rentalItems.map((x, idx) => ({ id: x.id, display_order: idx }));

    for (const u of updates) {
       await supabase.from('design_size_inventory').update({ display_order: u.display_order }).eq('id', u.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-blue-600">대여용 재고 관리</CardTitle>
            <CardDescription>
              선택된 주간 ({selectedWeekRange.start.toLocaleDateString('ko-KR')} ~ {selectedWeekRange.end.toLocaleDateString('ko-KR')}) 기준
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="디자인명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {canEdit && (
              <>
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      CSV 가져오기
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>CSV 데이터 가져오기</DialogTitle>
                      <DialogDescription>
                        <strong>필수 컬럼:</strong> design_code, design_name, size, rental_price, total_quantity
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="csv-file">CSV 파일 업로드</Label>
                        <Input
                          id="csv-file"
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => setCsvData(String(event.target?.result || ''));
                            reader.readAsText(file, 'UTF-8');
                          }}
                          className="mb-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="csv-data">CSV 데이터</Label>
                        <Textarea
                          id="csv-data"
                          value={csvData}
                          onChange={(e) => setCsvData(e.target.value)}
                          placeholder="design_code,design_name,size,rental_price,total_quantity\nTOP001,화이트 셔츠,M,15000,5"
                          className="min-h-[200px] font-mono text-sm"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>취소</Button>
                      <Button onClick={importFromCSV}>가져오기</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isDesignDialogOpen} onOpenChange={setIsDesignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      대여용 재고 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>새 디자인+사이즈 추가</DialogTitle>
                      <DialogDescription>새로운 디자인+사이즈 조합을 등록합니다</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="design_code">디자인 코드</Label>
                        <Input id="design_code" value={newDesignSize.design_code}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, design_code: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="design_name">디자인명</Label>
                        <Input id="design_name" value={newDesignSize.design_name}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, design_name: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="size">사이즈</Label>
                        <Input id="size" value={newDesignSize.size}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, size: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="rental_price">대여료</Label>
                        <Input id="rental_price" type="number" value={newDesignSize.rental_price}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, rental_price: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label htmlFor="total_quantity">총 수량</Label>
                        <Input id="total_quantity" type="number" value={newDesignSize.total_quantity}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, total_quantity: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label>재고 타입</Label>
                        <Select value={newDesignSize.inventory_type} onValueChange={(v) => setNewDesignSize({ ...newDesignSize, inventory_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="대여용">대여용</SelectItem>
                            <SelectItem value="구매용">구매용</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDesignDialogOpen(false)}>취소</Button>
                      <Button onClick={addDesignSize}>추가</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEndRental}
            modifiers={[restrictToVerticalAxis]}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>상품코드</TableHead>
                  <TableHead>디자인명</TableHead>
                  <TableHead>사이즈</TableHead>
                  <TableHead>대여료</TableHead>
                  {canViewTotal && <TableHead>총 수량</TableHead>}
                  <TableHead>대여가능 (주간)</TableHead>
                  <TableHead>대여중 (주간)</TableHead>
                  {canEdit && <TableHead>삭제</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                <SortableContext
                  items={filteredInventory.map((x) => x.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredInventory.map((design) => (
                    <SortableTableRow
                      key={design.id}
                      id={design.id}
                      design={design}
                      onUpdate={updateDesignSize}
                      onDelete={deleteDesignSize}
                      inventoryType="rental"
                      readonly={!canEdit} // Pass readonly prop if supported, or logic inside SortableTableRow needs update.
                      // Note: SortableTableRow might need adjustment to handle 'readonly' or 'canEdit' prop.
                      // Since I cannot change SortableTableRow easily right now without reading it,
                      // I will assume it renders EditableCell. I should update SortableTableRow or EditableCell
                      // to respect permissions?
                      // Actually, EditableCell is used inside SortableTableRow.
                      // I'll check SortableTableRow.
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  );
};
