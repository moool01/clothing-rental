import React, { useMemo, useState } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { useAuth } from '@/contexts/AuthContext';
import { DesignSizeInventory, WeekRange } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy
} from '@dnd-kit/sortable';
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
  weeklyStats?: DesignSizeInventory[];
}

export const RentalInventory: React.FC<RentalInventoryProps> = ({
  selectedWeekRange,
  inventory,
  setInventory,
  fetchData,
  COMPANY_ID,
  weeklyStats = [],
}) => {
  const { role } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isDesignDialogOpen, setIsDesignDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState('');

  const [newDesignSize, setNewDesignSize] = useState({
    design_code: '',
    design_name: '',
    size: '',
    rental_price: 0,
    total_quantity: 0,
    inventory_type: '대여용'
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canEdit = role === 'manager' || role === 'admin';
  const canViewTotal = role === 'admin';

  // ✅ "대여용만" 이 컴포넌트에서 다룬다
  const rentalOnly = useMemo(
    () => inventory.filter(x => x.inventory_type === '대여용'),
    [inventory]
  );

  // ✅ 대여용 + weeklyStats merge + 검색 필터
  const filteredInventory = useMemo(() => {
    const merged = rentalOnly.map(item => {
      const stat = weeklyStats.find(s => s.id === item.id);
      return stat ? {
        ...item,
        weekly_rented_quantity: stat.weekly_rented_quantity,
        weekly_available_quantity: stat.weekly_available_quantity
      } : item;
    });

    const q = searchQuery.trim().toLowerCase();
    if (!q) return merged;

    return merged.filter(item =>
      String(item.design_name ?? '').toLowerCase().includes(q)
    );
  }, [rentalOnly, weeklyStats, searchQuery]);

  const addDesignSize = async () => {
    try {
      const { data, error } = await supabase
        .from('design_size_inventory')
        .insert([{
          ...newDesignSize,
          inventory_type: '대여용', // ✅ 강제
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
        inventory_type: '대여용'
      });
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

    try {
      const { error } = await supabase
        .from('design_size_inventory')
        .update({ [field]: value })
        .eq('id', id);

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

        // ✅ 대여용 화면이므로 대여용으로 강제
        item.inventory_type = '대여용';

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

  // ✅ 드래그 정렬: "대여용 내부에서만" 정렬되게 수정
  const handleDragEndRental = async (event: DragEndEvent) => {
    if (!canEdit) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (searchQuery) {
      toast({ title: '알림', description: '검색 중에는 순서 변경이 불가능합니다.' });
      return;
    }

    const rentalItems = inventory.filter(x => x.inventory_type === '대여용');
    const nonRentalItems = inventory.filter(x => x.inventory_type !== '대여용');

    const oldIndex = rentalItems.findIndex(x => x.id === active.id);
    const newIndex = rentalItems.findIndex(x => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newRentalItems = arrayMove(rentalItems, oldIndex, newIndex);

    // 전체 재조립(정책: 대여용 먼저 + 나머지 뒤)
    const newInventory = [...newRentalItems, ...nonRentalItems];
    setInventory(newInventory);

    // DB에는 대여용만 display_order 업데이트
    const updates = newRentalItems.map((x, idx) => ({ id: x.id, display_order: idx }));

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
                        <Input
                          id="design_code"
                          value={newDesignSize.design_code}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, design_code: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="design_name">디자인명</Label>
                        <Input
                          id="design_name"
                          value={newDesignSize.design_name}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, design_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="size">사이즈</Label>
                        <Input
                          id="size"
                          value={newDesignSize.size}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, size: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="rental_price">대여료</Label>
                        <Input
                          id="rental_price"
                          type="number"
                          value={newDesignSize.rental_price}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, rental_price: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="total_quantity">총 수량</Label>
                        <Input
                          id="total_quantity"
                          type="number"
                          value={newDesignSize.total_quantity}
                          onChange={(e) => setNewDesignSize({ ...newDesignSize, total_quantity: Number(e.target.value) })}
                        />
                      </div>

                      {/* ✅ 대여용 화면이므로 드롭다운은 남겨도 되지만, 저장은 대여용 강제 */}
                      <div>
                        <Label>재고 타입</Label>
                        <Select
                          value={newDesignSize.inventory_type}
                          onValueChange={(v) => setNewDesignSize({ ...newDesignSize, inventory_type: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="대여용">대여용</SelectItem>
                            <SelectItem value="구매용">구매용</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          ※ 이 화면에서 추가하는 항목은 DB에 <b>대여용</b>으로 저장됩니다.
                        </p>
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
                  <TableHead>대여/예약 (주간)</TableHead>
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
                      readonly={!canEdit}
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