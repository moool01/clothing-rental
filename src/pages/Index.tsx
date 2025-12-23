<<<<<<< HEAD
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Trash2 } from 'lucide-react';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import EditableCell from '@/components/EditableCell';
import { SortableTableRow } from '@/components/SortableTableRow';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string | null;
  company_id?: string | null;
}

interface DesignSizeInventory {
  id: string;
  design_code: string;
  design_name: string;
  size: string;
  rental_price: number;
  total_quantity: number;
  rented_quantity: number;
  available_quantity: number;

  // 구매용 확장
  sold_quantity?: number | null;
  shipped_quantity?: number | null;
  available_for_sale?: number | null;
  outstanding_shipment?: number | null;
  shippable?: number | null;
  order_required?: number | null;

  condition?: string | null;
  inventory_type: string; // '대여용' | '구매용'
  display_order?: number | null;
  company_id?: string | null;
}

interface Rental {
  id: string;
  customer_id: string;
  design_code: string;
  design_name: string;
  size: string;
  quantity: number;
  rental_date: string;
  return_due_date: string;
  rental_price: number;
  status: string;
  customers?: Customer | null;
}

interface Purchase {
  id: string;
  customer_id: string;
  design_code: string;
  design_name: string;
  size: string;
  quantity: number;
  purchase_date: string;
  purchase_price: number;
  status: string;
  customers?: Customer | null;
}

interface Shipment {
  id: string;
  customer_id: string;
  design_code: string;
  design_name: string;
  size: string;
  quantity: number;
  shipment_date: string;
  tracking_number?: string | null;
  shipping_method: string;
  status: string;
  notes?: string | null;
  customers?: Customer | null;
}

type WeekRange = { start: Date; end: Date };

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const Index = () => {
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [designSizeInventory, setDesignSizeInventory] = useState<DesignSizeInventory[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  // 주간 데이터
  const [weeklyInventorySoldOut, setWeeklyInventorySoldOut] = useState<any[]>([]);
  const [allWeeklyInventory, setAllWeeklyInventory] = useState<any[]>([]);
  const [weeklyRentalInventory, setWeeklyRentalInventory] = useState<any[]>([]); // 드래그 정렬 + 주간수치 포함 렌더용
  const [rentalWeeklyInventory, setRentalWeeklyInventory] = useState<any[]>([]); // 대여 등록용 옵션

  // 폼 상태
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [newDesignSize, setNewDesignSize] = useState({
    design_code: '', design_name: '', size: '',
    rental_price: 0, total_quantity: 0, inventory_type: '대여용'
  });
  const [newRental, setNewRental] = useState({
    customer_id: '', design_code: '', design_name: '', size: '', quantity: 1,
    rental_date: '', return_due_date: '', rental_price: 0
  });
  const [newPurchase, setNewPurchase] = useState({
    customer_id: '', design_code: '', design_name: '', size: '', quantity: 1,
    purchase_date: '', purchase_price: 0
  });
  const [newShipment, setNewShipment] = useState({
    customer_id: '',
    design_code: '',
    design_name: '',
    size: '',
    quantity: 1,
    shipment_date: new Date().toISOString().split('T')[0],
    tracking_number: '',
    shipping_method: '택배',
    status: '출고완료',
    notes: ''
  });

  // 다이얼로그
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isDesignDialogOpen, setIsDesignDialogOpen] = useState(false);
  const [isRentalDialogOpen, setIsRentalDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const [csvData, setCsvData] = useState('');

  // 달력 및 주간
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekRange, setSelectedWeekRange] = useState<WeekRange>(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ---------- 유틸: 날짜 범위 계산 ----------
  const getWeekRange = (date: Date): WeekRange => {
    const monday = new Date(date);
    monday.setDate(date.getDate() - date.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  };

  // ---------- 주간 재고 계산 (달력 탭) ----------
  const calculateWeeklyInventory = (startDate: Date, endDate: Date) => {
    const weeklyData = designSizeInventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const totalAvailable = item.total_quantity;

        // 화~일 대여중 합계 (quantity 기준)
        const tuesday = new Date(startDate);
        tuesday.setDate(startDate.getDate() + 1);

        const weekRentalsQty = rentals
          .filter(r => {
            const rd = new Date(r.rental_date);
            return (
              rd >= tuesday &&
              rd <= endDate &&
              r.design_name === item.design_name &&
              r.size === item.size &&
              r.status === '대여중'
            );
          })
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        // 월요일 반납완료 합계 (quantity 기준)
        const monday = new Date(startDate);
        const weekReturnedQty = rentals
          .filter(r => {
            const due = new Date(r.return_due_date);
            return (
              due.toDateString() === monday.toDateString() &&
              r.design_name === item.design_name &&
              r.size === item.size &&
              r.status === '반납완료'
            );
          })
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        const finalAvailable = Math.max(0, totalAvailable - weekRentalsQty);

        return {
          ...item,
          weekRentals: weekRentalsQty,
          weekReturned: weekReturnedQty,
          finalAvailable,
        };
      });

    setAllWeeklyInventory(weeklyData);
    setWeeklyInventorySoldOut(weeklyData.filter(x => x.finalAvailable === 0));
  };

  // ---------- 주간 기준 대여용 테이블(드래그 포함) 계산 ----------
  const calculateWeeklyRentalInventory = (weekStart: Date, weekEnd: Date) => {
    // “대여중/연체”는 해당 주간에 걸쳐있으면 차감(겹침)
    // (return_due_date를 “반납 예정/반납일”처럼 취급)
    return designSizeInventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const overlappedQty = rentals
          .filter(r => {
            if (r.design_code !== item.design_code || r.size !== item.size) return false;
            if (r.status !== '대여중' && r.status !== '연체') return false;

            const rentalDate = new Date(r.rental_date);
            const dueDate = r.return_due_date ? new Date(r.return_due_date) : null;

            const startsBeforeWeekEnds = rentalDate <= weekEnd;
            const endsAfterWeekStarts = !dueDate || dueDate >= weekStart;

            return startsBeforeWeekEnds && endsAfterWeekStarts;
          })
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        const weeklyAvailable = Math.max(0, (item.total_quantity || 0) - overlappedQty);

        return {
          ...item,
          weekly_rented_quantity: overlappedQty,
          weekly_available_quantity: weeklyAvailable,
        };
      });
  };

  // ---------- 대여 등록용: 선택한 대여일 기준 그 주의 “대여가능 목록” ----------
  const calculateRentalWeeklyInventory = (rentalDate: string) => {
    try {
      if (!rentalDate) return setRentalWeeklyInventory([]);

      if (!designSizeInventory.length || !Array.isArray(rentals)) {
        setRentalWeeklyInventory([]);
        return;
      }

      const selected = new Date(rentalDate);
      const { start: monday, end: sunday } = getWeekRange(selected);

      const tuesday = new Date(monday);
      tuesday.setDate(monday.getDate() + 1);

      const weeklyData = designSizeInventory
        .filter(item => item.inventory_type === '대여용')
        .map(item => {
          const weekRentalsQty = rentals
            .filter(r => {
              const rd = new Date(r.rental_date);
              return (
                rd >= tuesday &&
                rd <= sunday &&
                r.design_name === item.design_name &&
                r.size === item.size &&
                r.status === '대여중'
              );
            })
            .reduce((sum, r) => sum + (r.quantity || 0), 0);

          const finalAvailable = Math.max(0, (item.total_quantity || 0) - weekRentalsQty);

          return { ...item, weekRentals: weekRentalsQty, finalAvailable };
        })
        .filter(x => x.finalAvailable > 0);

      setRentalWeeklyInventory(weeklyData);
    } catch (e) {
      console.error('대여 주간 재고 계산 오류:', e);
      setRentalWeeklyInventory([]);
    }
  };

  // ---------- 날짜 선택 ----------
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);

    const range = getWeekRange(date);
    setSelectedWeekRange(range);
    calculateWeeklyInventory(range.start, range.end);
  };

  // ---------- 데이터 로딩 ----------
  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: designSizeData, error: designSizeError } = await supabase
        .from('design_size_inventory')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('design_code', { ascending: true });

      if (designSizeError) throw designSizeError;
      setDesignSizeInventory(designSizeData || []);

      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select(`*, customers(*)`)
        .order('created_at', { ascending: false });

      if (rentalsError) throw rentalsError;
      setRentals((rentalsData as Rental[]) || []);

      const { data: purchasesData, error: purchasesError } = await supabase
        .from('purchases')
        .select(`*, customers(*)`)
        .order('created_at', { ascending: false });

      if (purchasesError) throw purchasesError;
      setPurchases((purchasesData as Purchase[]) || []);

      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select(`*, customers(*)`)
        .order('created_at', { ascending: false });

      if (shipmentsError) throw shipmentsError;
      setShipments((shipmentsData as Shipment[]) || []);

      // rentalsData 기반 고객 목록 만들기 (중복 제거)
      const map = new Map<string, Customer>();
      (rentalsData as Rental[] | null || []).forEach(r => {
        if (r.customer_id && r.customers && !map.has(r.customer_id)) {
          map.set(r.customer_id, r.customers);
        }
      });
      setCustomers(Array.from(map.values()));

      // 주간 계산 초기화
      const range = selectedWeekRange;
      calculateWeeklyInventory(range.start, range.end);
      setWeeklyRentalInventory(calculateWeeklyRentalInventory(range.start, range.end));

    } catch (error: any) {
      toast({
        title: '데이터 로딩 실패',
        description: error?.message || '알 수 없는 오류',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (designSizeInventory.length > 0) {
      calculateWeeklyInventory(selectedWeekRange.start, selectedWeekRange.end);
      setWeeklyRentalInventory(calculateWeeklyRentalInventory(selectedWeekRange.start, selectedWeekRange.end));
    }
    // rentals가 바뀌면 주간 수치 갱신
  }, [designSizeInventory, rentals, selectedWeekRange]);

  // ---------- CRUD ----------
  const addCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...newCustomer, company_id: COMPANY_ID }])
        .select();

      if (error) throw error;

      setCustomers(prev => [...prev, data?.[0]]);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setIsCustomerDialogOpen(false);

      toast({ title: '고객 추가 완료', description: '새 고객이 추가되었습니다.' });
    } catch (e: any) {
      toast({ title: '고객 추가 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

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

      setDesignSizeInventory(prev => [...prev, data?.[0]]);
      setNewDesignSize({ design_code: '', design_name: '', size: '', rental_price: 0, total_quantity: 0, inventory_type: '대여용' });
      setIsDesignDialogOpen(false);

      toast({ title: '재고 추가 완료', description: '새 디자인+사이즈가 추가되었습니다.' });
    } catch (e: any) {
      toast({ title: '재고 추가 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const updateDesignSize = async (id: string, field: string, value: any) => {
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
    try {
      const { error } = await supabase.from('design_size_inventory').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '삭제 완료', description: '삭제되었습니다.' });
    } catch (e: any) {
      toast({ title: '삭제 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

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

  const addPurchase = async () => {
    try {
      if (!newPurchase.customer_id || !newPurchase.design_code || !newPurchase.purchase_date) {
        toast({ title: '입력 오류', description: '필수 항목을 입력해주세요.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('purchases')
        .insert([{ ...newPurchase, company_id: COMPANY_ID }]);

      if (error) throw error;

      setIsPurchaseDialogOpen(false);
      setNewPurchase({ customer_id: '', design_code: '', design_name: '', size: '', quantity: 1, purchase_date: '', purchase_price: 0 });

      setTimeout(fetchData, 120);
      toast({ title: '구매 등록 완료', description: '구매가 등록되었습니다.' });
    } catch (e: any) {
      toast({ title: '구매 등록 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const deletePurchase = async (id: string) => {
    try {
      const { error } = await supabase.from('purchases').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      toast({ title: '구매 삭제 완료', description: '구매 기록이 삭제되었습니다.' });
    } catch (e: any) {
      toast({ title: '구매 삭제 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

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
        tracking_number: '',
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

  // ---------- CSV ----------
  const importFromCSV = async () => {
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

  // ---------- 드래그 정렬 (inventory_type별로만 reorder) ----------
  const reorderWithinType = async (inventoryType: '대여용' | '구매용', activeId: string, overId: string) => {
    const filtered = designSizeInventory.filter(x => x.inventory_type === inventoryType);
    const oldIndex = filtered.findIndex(x => x.id === activeId);
    const newIndex = filtered.findIndex(x => x.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const moved = arrayMove(filtered, oldIndex, newIndex);

    // 전체 배열에 반영 (해당 타입 항목만 교체)
    const merged = designSizeInventory.map(x => x.inventory_type === inventoryType ? moved.shift()! : x);
    setDesignSizeInventory(merged);

    // DB display_order 업데이트: 해당 타입만 연속으로
    const updates = merged
      .filter(x => x.inventory_type === inventoryType)
      .map((x, idx) => ({ id: x.id, display_order: idx }));

    for (const u of updates) {
      await supabase.from('design_size_inventory').update({ display_order: u.display_order }).eq('id', u.id);
    }
  };

  const handleDragEndRental = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    try {
      await reorderWithinType('대여용', String(active.id), String(over.id));
      toast({ title: '순서 변경 완료', description: '대여용 재고 순서가 변경되었습니다.' });
    } catch (e: any) {
      await fetchData();
      toast({ title: '순서 변경 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  const handleDragEndPurchase = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    try {
      await reorderWithinType('구매용', String(active.id), String(over.id));
      toast({ title: '순서 변경 완료', description: '구매용 재고 순서가 변경되었습니다.' });
    } catch (e: any) {
      await fetchData();
      toast({ title: '순서 변경 실패', description: e?.message || '오류', variant: 'destructive' });
    }
  };

  // ---------- 렌더용 리스트 ----------
  const rentalRows = useMemo(() => weeklyRentalInventory, [weeklyRentalInventory]);
  const purchaseRows = useMemo(
    () => designSizeInventory.filter(x => x.inventory_type === '구매용'),
    [designSizeInventory],
  );
=======
import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { useInventory } from '@/hooks/useInventory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WeeklyCalendar } from '@/components/domain/WeeklyCalendar';
import { RentalInventory } from '@/components/domain/RentalInventory';
import { RentalManagement } from '@/components/domain/RentalManagement';
import { PurchaseInventory } from '@/components/domain/PurchaseInventory';
import { ShipmentManagement } from '@/components/domain/ShipmentManagement';
import { PurchaseManagement } from '@/components/domain/PurchaseManagement';
import { CustomerManagement } from '@/components/domain/CustomerManagement';
import { StatisticsReports } from '@/components/domain/StatisticsReports';

const Dashboard = () => {
  const { role, setRole } = useAuth();
  const {
    loading,
    customers,
    setCustomers,
    designSizeInventory,
    setDesignSizeInventory,
    rentals,
    setRentals,
    purchases,
    setPurchases,
    shipments,
    weeklyInventorySoldOut,
    allWeeklyInventory,
    weeklyRentalInventory,
    setWeeklyRentalInventory,
    rentalWeeklyInventory,
    setRentalWeeklyInventory,
    fetchData,
    calculateWeeklyInventory,
    calculateWeeklyRentalInventory,
    calculateRentalWeeklyInventory,
    getWeekRange,
    COMPANY_ID
  } = useInventory();
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekRange, setSelectedWeekRange] = useState(() => getWeekRange(new Date()));

  // Role-based Tab Access
  // Staff: Weekly Calendar, Rental Inventory (View), Rental Management (All)
  // Manager: + Edit Inventory, Edit Rental Price
  // Admin: + Statistics, Total Quantity

  // We will show all tabs but control content inside.
  // Except Reports which is Admin only usually, but let's keep tabs visible and show "Access Denied" inside or hide tab?
  // User Requirement: "Admin (Function approval, Statistics) -> Statistics report access"
  // So hide Reports tab for non-admin? Or disable. I'll hide it.

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const range = getWeekRange(date);
    setSelectedWeekRange(range);
    calculateWeeklyInventory(range.start, range.end, designSizeInventory, rentals);
  };

  useEffect(() => {
    if (designSizeInventory.length > 0) {
      calculateWeeklyInventory(selectedWeekRange.start, selectedWeekRange.end, designSizeInventory, rentals);
      setWeeklyRentalInventory(calculateWeeklyRentalInventory(selectedWeekRange.start, selectedWeekRange.end, designSizeInventory, rentals));
    }
  }, [designSizeInventory, rentals, selectedWeekRange, calculateWeeklyInventory, calculateWeeklyRentalInventory, setWeeklyRentalInventory]);

>>>>>>> subin

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
<<<<<<< HEAD
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">의류 대여 재고관리 시스템</h1>
          <p className="text-gray-600 mt-2">재고 관리 및 대여 현황 추적</p>
        </div>

        <Tabs defaultValue="weekly-calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
=======
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">의류 대여 재고관리 시스템</h1>
            <p className="text-gray-600 mt-2">재고 관리 및 대여 현황 추적</p>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded shadow-sm border">
            <span className="text-sm font-medium text-gray-600">
                {role === 'staff' ? '직원' : role === 'manager' ? '실장' : '관리자'} 님
            </span>
            <button
                onClick={() => setRole(null)}
                className="text-xs text-red-500 hover:text-red-700 underline ml-2"
            >
                로그아웃
            </button>
          </div>
        </div>

        <Tabs defaultValue="weekly-calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto">
>>>>>>> subin
            <TabsTrigger value="weekly-calendar">주간달력</TabsTrigger>
            <TabsTrigger value="rental-inventory">대여용재고</TabsTrigger>
            <TabsTrigger value="rentals">대여관리</TabsTrigger>
            <TabsTrigger value="purchase-inventory">구매용 재고</TabsTrigger>
            <TabsTrigger value="shipments">출고관리</TabsTrigger>
            <TabsTrigger value="purchases">구매관리</TabsTrigger>
            <TabsTrigger value="customers">고객관리</TabsTrigger>
<<<<<<< HEAD
            <TabsTrigger value="reports">통계리포트</TabsTrigger>
          </TabsList>

          {/* =========================
              주간 달력 탭
          ========================= */}
          <TabsContent value="weekly-calendar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>달력 선택</CardTitle>
                  <CardDescription>날짜를 선택하면 해당 주간의 재고 현황을 보여줍니다</CardDescription>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    className="rounded-md border"
                    modifiers={{
                      selectedWeek: (date) => date >= selectedWeekRange.start && date <= selectedWeekRange.end
                    }}
                    modifiersClassNames={{
                      selectedWeek: 'rdp-day_selected_week'
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>주간 재고 현황</CardTitle>
                  <CardDescription>매주 초기화되는 재고 시스템 (화-일 대여, 월요일 반납)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                      <div className="font-semibold text-blue-800 mb-2">선택된 주간</div>
                      <div className="text-lg font-bold text-blue-600">
                        {`${selectedWeekRange.start.getFullYear()}년 ${selectedWeekRange.start.getMonth() + 1}월 ${selectedWeekRange.start.getDate()}일 ~ ${selectedWeekRange.end.getMonth() + 1}월 ${selectedWeekRange.end.getDate()}일`}
                      </div>
                      <div className="text-sm text-blue-500 mt-1">
                        매주 초기화되는 재고 시스템 (화-일 대여, 월요일 반납)
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="font-medium text-gray-800 mb-3">마감된 디자인 리스트 (availability = 0)</h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        {weeklyInventorySoldOut.length === 0 ? (
                          <div className="text-gray-500 text-sm text-center py-2">
                            마감된 디자인이 없습니다.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {weeklyInventorySoldOut.map((item) => (
                              <div key={item.id} className="flex justify-between items-center bg-white rounded px-3 py-2 border border-red-100">
                                <div className="flex items-center space-x-3">
                                  <span className="font-medium text-red-800">{item.design_name}</span>
                                  <span className="text-sm text-red-600">({item.size})</span>
                                </div>
                                <div className="text-xs text-red-500">
                                  총 {item.total_quantity}개 중 {item.weekRentals}개 대여중
                                </div>
                              </div>
                            ))}
                            <div className="text-xs text-red-600 mt-3 text-center">
                              총 {weeklyInventorySoldOut.length}개 디자인이 마감되었습니다.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>주간 상세 재고 분석</CardTitle>
                <CardDescription>선택된 주간의 디자인+사이즈별 상세 재고 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>상품코드</TableHead>
                        <TableHead>디자인명</TableHead>
                        <TableHead>사이즈</TableHead>
                        <TableHead>총 수량</TableHead>
                        <TableHead>화-일 대여중</TableHead>
                        <TableHead>대여 가능</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(allWeeklyInventory || []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.design_code}</TableCell>
                          <TableCell>{item.design_name}</TableCell>
                          <TableCell>{item.size}</TableCell>
                          <TableCell><Badge variant="outline">{item.total_quantity}개</Badge></TableCell>
                          <TableCell><Badge className="bg-orange-100 text-orange-800">{item.weekRentals}개</Badge></TableCell>
                          <TableCell><Badge className="bg-green-100 text-green-800 font-bold">{item.finalAvailable}개</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================
              대여용 재고 탭 (DndContext는 Table 밖!)
          ========================= */}
          <TabsContent value="rental-inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-blue-600">대여용 재고 관리</CardTitle>
                    <CardDescription>
                      선택된 주간 ({selectedWeekRange.start.toLocaleDateString('ko-KR')} ~ {selectedWeekRange.end.toLocaleDateString('ko-KR')}) 기준
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
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
                          <TableHead>총 수량</TableHead>
                          <TableHead>대여가능 (주간)</TableHead>
                          <TableHead>대여중 (주간)</TableHead>
                          <TableHead>삭제</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        <SortableContext
                          items={rentalRows.map((x: any) => x.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {rentalRows.map((design: any) => (
                            <SortableTableRow
                              key={design.id}
                              id={design.id}
                              design={design}
                              onUpdate={updateDesignSize}
                              onDelete={deleteDesignSize}
                              inventoryType="rental"
                            />
                          ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================
              대여 관리 탭
          ========================= */}
          <TabsContent value="rentals" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>대여 관리</CardTitle>
                    <CardDescription>의류 대여 현황을 관리합니다</CardDescription>
                  </div>

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
                        <TableHead>대여일</TableHead>
                        <TableHead>반납예정일</TableHead>
                        <TableHead>대여료</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((r) => (
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
                            <EditableCell value={r.status} type="select" options={['대여중', '반납완료', '연체']}
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
          </TabsContent>

          {/* =========================
              구매용 재고 탭 (DndContext는 Table 밖!)
          ========================= */}
          <TabsContent value="purchase-inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-purple-600">구매용 재고 관리</CardTitle>
                    <CardDescription>판매 비즈니스용 재고를 관리합니다</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      setNewDesignSize({ ...newDesignSize, inventory_type: '구매용' });
                      setIsDesignDialogOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />구매용 재고 추가
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
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
                          <TableHead className="w-8"></TableHead>
                          <TableHead>상품코드</TableHead>
                          <TableHead>디자인명</TableHead>
                          <TableHead>사이즈</TableHead>
                          <TableHead>판매가</TableHead>
                          <TableHead>총 수량</TableHead>
                          <TableHead>판매됨</TableHead>
                          <TableHead>출고완료</TableHead>
                          <TableHead>ATS</TableHead>
                          <TableHead>주문필요량</TableHead>
                          <TableHead>삭제</TableHead>
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
                            />
                          ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================
              출고 관리 탭 (렌더링 safe: customers?.name)
          ========================= */}
          <TabsContent value="shipments" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-green-600">출고 관리</CardTitle>
                    <CardDescription>구매용 상품의 출고 및 배송을 관리합니다</CardDescription>
                  </div>
                  <Button onClick={() => setIsShipmentDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />출고 등록
                  </Button>
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
                        <TableHead>송장번호</TableHead>
                        <TableHead>배송방법</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>액션</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {shipments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground">출고 기록이 없습니다</TableCell>
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
                            <EditableCell value={s.tracking_number || ''} type="text" onSave={(v) => updateShipment(s.id, 'tracking_number', v)} />
                          </TableCell>
                          <TableCell>
                            <EditableCell value={s.shipping_method} type="select" options={['택배', '등기', '직접수령']}
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
            </Card>

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
                      <Label>송장번호</Label>
                      <Input value={newShipment.tracking_number}
                        onChange={(e) => setNewShipment({ ...newShipment, tracking_number: e.target.value })} />
                    </div>
                    <div>
                      <Label>배송방법</Label>
                      <Select value={newShipment.shipping_method} onValueChange={(v) => setNewShipment({ ...newShipment, shipping_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="택배">택배</SelectItem>
                          <SelectItem value="등기">등기</SelectItem>
                          <SelectItem value="직접수령">직접수령</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
          </TabsContent>

          {/* =========================
              구매 관리 탭 (customers?.name)
          ========================= */}
          <TabsContent value="purchases" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-purple-600">구매 관리</CardTitle>
                    <CardDescription>구매용 재고의 구매 현황을 관리합니다</CardDescription>
                  </div>
                  <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                    <DialogTrigger asChild>
                      <Button><Plus className="h-4 w-4 mr-2" />구매 등록</Button>
                    </DialogTrigger>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>새 구매 등록</DialogTitle>
                        <DialogDescription>새로운 구매를 등록합니다</DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div>
                          <Label>고객</Label>
                          <Select value={newPurchase.customer_id} onValueChange={(v) => setNewPurchase({ ...newPurchase, customer_id: v })}>
                            <SelectTrigger><SelectValue placeholder="고객을 선택하세요" /></SelectTrigger>
                            <SelectContent>
                              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>구매일</Label>
                          <Input type="date" value={newPurchase.purchase_date}
                            onChange={(e) => setNewPurchase({ ...newPurchase, purchase_date: e.target.value })} />
                        </div>

                        <div>
                          <Label>구매용 상품</Label>
                          <Select
                            value={newPurchase.design_code && newPurchase.size ? `${newPurchase.design_code}-${newPurchase.size}` : ''}
                            onValueChange={(value) => {
                              const found = purchaseRows.find(x => `${x.design_code}-${x.size}` === value);
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
                            <SelectTrigger><SelectValue placeholder="구매용 상품을 선택하세요" /></SelectTrigger>
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
                            <Input type="number" min="1" value={newPurchase.quantity}
                              onChange={(e) => setNewPurchase({ ...newPurchase, quantity: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label>구매가</Label>
                            <Input type="number" value={newPurchase.purchase_price}
                              onChange={(e) => setNewPurchase({ ...newPurchase, purchase_price: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>취소</Button>
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
                        <TableHead>구매일</TableHead>
                        <TableHead>구매가</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>액션</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {purchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">구매 기록이 없습니다</TableCell>
                        </TableRow>
                      ) : purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.design_name}</TableCell>
                          <TableCell><Badge variant="secondary">{p.size}</Badge></TableCell>
                          <TableCell><Badge className="bg-purple-100 text-purple-800">{p.quantity}개</Badge></TableCell>
                          <TableCell>{p.customers?.name || '-'}</TableCell>
                          <TableCell>{p.purchase_date}</TableCell>
                          <TableCell>{(p.purchase_price || 0).toLocaleString()}원</TableCell>
                          <TableCell>
                            <Badge variant={p.status === '구매완료' ? 'default' : p.status === '취소' ? 'destructive' : 'secondary'}>
                              {p.status || '구매완료'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => deletePurchase(p.id)} className="h-8 w-8 p-0 text-red-600 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>

                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================
              고객 관리 탭
          ========================= */}
          <TabsContent value="customers" className="space-y-6">
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
                        <div>
                          <Label>이메일</Label>
                          <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                        </div>
                        <div>
                          <Label>주소</Label>
                          <Input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
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
                        <TableHead>이메일</TableHead>
                        <TableHead>주소</TableHead>
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
                            <TableCell><EditableCell value={c.email} type="text" onSave={(v) => updateCustomer(c.id, 'email', v)} /></TableCell>
                            <TableCell><EditableCell value={c.address || ''} type="text" onSave={(v) => updateCustomer(c.id, 'address', v)} /></TableCell>
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
          </TabsContent>

          {/* =========================
              통계 리포트 탭
          ========================= */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>대여 현황 통계</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded">
                      <div className="text-2xl font-bold text-blue-600">
                        {designSizeInventory.reduce((sum, item) => sum + (item.rented_quantity || 0), 0)}
                      </div>
                      <div className="text-sm text-gray-600">현재 대여중</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded">
                      <div className="text-2xl font-bold text-green-600">
                        {designSizeInventory.reduce((sum, item) => sum + ((item.rented_quantity || 0) * (item.rental_price || 0)), 0).toLocaleString()}원
                      </div>
                      <div className="text-sm text-gray-600">예상 매출</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>수익 분석</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-purple-50 rounded">
                      <div className="text-2xl font-bold text-purple-600">
                        {designSizeInventory.reduce((sum, item) => sum + ((item.rented_quantity || 0) * (item.rental_price || 0)), 0).toLocaleString()}원
                      </div>
                      <div className="text-sm text-gray-600">총 대여 매출</div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">대여율 높은 아이템 TOP 5</h4>
                      <div className="space-y-2">
                        {designSizeInventory
                          .filter(x => (x.total_quantity || 0) > 0 && x.inventory_type === '대여용')
                          .map(x => ({
                            ...x,
                            utilizationRate: Math.round(((x.rented_quantity || 0) / (x.total_quantity || 1)) * 100),
                          }))
                          .sort((a, b) => b.utilizationRate - a.utilizationRate)
                          .slice(0, 5)
                          .map((x, idx) => (
                            <div key={x.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                              <span>{idx + 1}. {x.design_name} ({x.size})</span>
                              <span className="font-medium">이용율 {x.utilizationRate}%</span>
                            </div>
                          ))}
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
=======
            {role === 'admin' && <TabsTrigger value="reports">통계리포트</TabsTrigger>}
          </TabsList>

          <TabsContent value="weekly-calendar">
            <WeeklyCalendar
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              selectedWeekRange={selectedWeekRange}
              weeklyInventorySoldOut={weeklyInventorySoldOut}
              allWeeklyInventory={allWeeklyInventory}
            />
          </TabsContent>

          <TabsContent value="rental-inventory">
            <RentalInventory
              selectedWeekRange={selectedWeekRange}
              inventory={designSizeInventory}
              setInventory={setDesignSizeInventory}
              fetchData={fetchData}
              COMPANY_ID={COMPANY_ID}
              weeklyStats={weeklyRentalInventory}
            />
          </TabsContent>

          <TabsContent value="rentals">
            <RentalManagement
              rentals={rentals}
              setRentals={setRentals}
              customers={customers}
              designSizeInventory={designSizeInventory}
              fetchData={fetchData}
              rentalWeeklyInventory={rentalWeeklyInventory}
              setRentalWeeklyInventory={setRentalWeeklyInventory}
              calculateRentalWeeklyInventory={calculateRentalWeeklyInventory}
              COMPANY_ID={COMPANY_ID}
            />
          </TabsContent>

          <TabsContent value="purchase-inventory">
            <PurchaseInventory
              inventory={designSizeInventory}
              setInventory={setDesignSizeInventory}
              fetchData={fetchData}
              COMPANY_ID={COMPANY_ID}
            />
          </TabsContent>

          <TabsContent value="shipments">
            <ShipmentManagement
              shipments={shipments}
              customers={customers}
              inventory={designSizeInventory}
              fetchData={fetchData}
              COMPANY_ID={COMPANY_ID}
            />
          </TabsContent>

          <TabsContent value="purchases">
            <PurchaseManagement
              purchases={purchases}
              customers={customers}
              inventory={designSizeInventory}
              fetchData={fetchData}
              COMPANY_ID={COMPANY_ID}
            />
          </TabsContent>

          <TabsContent value="customers">
            <CustomerManagement
              customers={customers}
              setCustomers={setCustomers}
              rentals={rentals}
              fetchData={fetchData}
              COMPANY_ID={COMPANY_ID}
            />
          </TabsContent>

          {role === 'admin' && (
            <TabsContent value="reports">
              <StatisticsReports
                inventory={designSizeInventory}
                rentals={rentals}
                purchases={purchases}
                shipments={shipments}
                weekStart={formatLocalDate(selectedWeekRange.start)}
                weekEnd={formatLocalDate(selectedWeekRange.end)}
              />
            </TabsContent>
          )}
>>>>>>> subin
        </Tabs>
      </div>
    </div>
  );
};

<<<<<<< HEAD
export default Index;
=======
export default function Index() {
  return <Dashboard />;
}
>>>>>>> subin
