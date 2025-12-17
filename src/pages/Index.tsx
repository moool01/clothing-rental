import React, { useState, useEffect } from 'react';
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
import { Plus, Upload, Trash2, Edit, GripVertical } from 'lucide-react';
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
  address?: string;
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
  sold_quantity?: number;
  available_for_sale?: number;
  order_required?: number;
  condition?: string;
}

interface ClothingItem {
  id: string;
  item_code: string;
  name: string;
  category: string;
  season?: string;
  brand?: string;
  size: string;
  color: string;
  rental_price: number;
  purchase_price: number;
  condition: string;
  status: string;
  notes?: string;
  inventory_type: string;
  design_code?: string;
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
  customers_2025_11_21_07_27?: Customer;
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
  customers_2025_11_21_07_27?: Customer;
}

interface Shipment {
  id: string;
  customer_id: string;
  design_code: string;
  design_name: string;
  size: string;
  quantity: number;
  shipment_date: string;
  tracking_number?: string;
  shipping_method: string;
  status: string;
  notes?: string;
  customers_2025_11_21_07_27?: Customer;
}

const Index = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [designSizeInventory, setDesignSizeInventory] = useState<DesignSizeInventory[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 주간 데이터 상태
  const [weeklyInventory, setWeeklyInventory] = useState<any[]>([]);
  const [allWeeklyInventory, setAllWeeklyInventory] = useState<any[]>([]);

  const [weeklyRentalInventory, setWeeklyRentalInventory] = useState<any[]>([]);
  const [rentalWeeklyInventory, setRentalWeeklyInventory] = useState<any[]>([]); // 대여 등록용 주간 재고
  const { toast } = useToast();

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
    customer_id: '', design_code: '', design_name: '', size: '', quantity: 1,
    shipment_date: '', tracking_number: '', shipping_method: '택배', status: '출고완료', notes: ''
  });
  const [newItem, setNewItem] = useState({
    item_code: '', name: '', category: '', season: '', brand: '', size: '', color: '',
    rental_price: 0, purchase_price: 0, condition: '양호', notes: '', inventory_type: '대여용', design_code: ''
  });

  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isDesignDialogOpen, setIsDesignDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isRentalDialogOpen, setIsRentalDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState('');
  
  // 달력 및 주간 선택 상태
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekRange, setSelectedWeekRange] = useState<{start: Date, end: Date}>(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1); // 월요일로 설정
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // 일요일로 설정
    return { start: monday, end: sunday };
  });
  // 날짜 선택 시 주간 범위 자동 설정
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDate(date);
    
    // 선택된 날짜가 포함된 주간 범위 계산 (월~일)
    const monday = new Date(date);
    monday.setDate(date.getDate() - date.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    setSelectedWeekRange({ start: monday, end: sunday });
    calculateWeeklyInventory(monday, sunday);
  };
  
  // 주간 재고 계산 함수 (새로운 요구사항: 화-일 대여, 월요일 반납, 매주 재고 초기화)
  const calculateWeeklyInventory = (startDate: Date, endDate: Date) => {
    const weeklyData = designSizeInventory.filter(item => item.inventory_type === '대여용').map(item => {
      // 매주 초기화되는 기본 재고 수량
      const totalAvailable = item.total_quantity;
      
      // 해당 주간(화-일) 대여 예정 수량 계산
      const weekRentals = rentals.filter(rental => {
        const rentalDate = new Date(rental.rental_date);
        const tuesday = new Date(startDate);
        tuesday.setDate(startDate.getDate() + 1); // 화요일
        const sunday = new Date(endDate); // 일요일
        
        return rentalDate >= tuesday && rentalDate <= sunday && 
               rental.design_name === item.design_name && 
               rental.size === item.size &&
               rental.status === '대여중';
      }).reduce((sum, rental) => sum + rental.quantity, 0);
      
      // 해당 주간에 반납완료된 아이템 수량 계산
      const weekReturned = rentals.filter(rental => {
        const returnDate = new Date(rental.return_due_date);
        const monday = new Date(startDate); // 월요일
        
        return returnDate.toDateString() === monday.toDateString() && 
               rental.design_name === item.design_name && 
               rental.size === item.size &&
               rental.status === '반납완료';
      }).reduce((sum, rental) => sum + rental.quantity, 0);
      
      // 최종 대여 가능 수량 = 총 수량 - 해당 주간 대여 수량
      const finalAvailable = Math.max(0, totalAvailable - weekRentals);
      
      return {
        ...item,
        weekRentals, // 해당 주간 대여 수량
        weekReturned, // 해당 주간 반납완료 수량
        finalAvailable // 대여 가능 수량
      };
    });
    
    // 마감된 디자인용: availability = 0인 아이템만 필터링
    const soldOutData = weeklyData.filter(item => item.finalAvailable === 0);
    
    // 상태 업데이트
    setWeeklyInventory(soldOutData); // 마감된 디자인용
    setAllWeeklyInventory(weeklyData); // 주간 상세 재고 분석용 (모든 재고)
  };
  
  // 대여 등록용 주간 재고 계산 함수
  const calculateRentalWeeklyInventory = (rentalDate: string) => {
    try {
      if (!rentalDate) {
        setRentalWeeklyInventory([]);
        return;
      }
      
      // 데이터가 아직 로드되지 않았을 때 안전 처리
      if (!designSizeInventory || !Array.isArray(designSizeInventory) || designSizeInventory.length === 0) {
        console.log('대여용 재고 데이터가 아직 로드되지 않음');
        setRentalWeeklyInventory([]);
        return;
      }
      
      if (!rentals || !Array.isArray(rentals)) {
        console.log('대여 데이터가 아직 로드되지 않음');
        setRentalWeeklyInventory([]);
        return;
      }
      
      const selectedDate = new Date(rentalDate);
      const monday = new Date(selectedDate);
      monday.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const weeklyData = designSizeInventory.filter(item => item && item.inventory_type === '대여용').map(item => {
      // 매주 초기화되는 기본 재고 수량
      const totalAvailable = item.total_quantity;
      
      // 해당 주간(화-일) 대여 예정 수량 계산
      const weekRentals = rentals.filter(rental => {
        const rentalDateObj = new Date(rental.rental_date);
        const tuesday = new Date(monday);
        tuesday.setDate(monday.getDate() + 1); // 화요일
        
        return rentalDateObj >= tuesday && rentalDateObj <= sunday && 
               rental.design_name === item.design_name && 
               rental.size === item.size &&
               rental.status === '대여중';
      }).reduce((sum, rental) => sum + rental.quantity, 0);
      
      // 최종 대여 가능 수량 = 총 수량 - 해당 주간 대여 수량
      const finalAvailable = Math.max(0, totalAvailable - weekRentals);
      
      return {
        ...item,
        weekRentals,
        finalAvailable
      };
    }).filter(item => item && item.finalAvailable > 0); // 대여 가능한 아이템만 필터링
    
    setRentalWeeklyInventory(weeklyData);
    } catch (error) {
      console.error('대여 주간 재고 계산 오류:', error);
      setRentalWeeklyInventory([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  useEffect(() => {
    if (designSizeInventory.length > 0) {
      calculateWeeklyInventory(selectedWeekRange.start, selectedWeekRange.end);
      // 주간 기준 대여용 재고도 계산
      const weeklyRental = calculateWeeklyRentalInventory(selectedWeekRange.start, selectedWeekRange.end);
      setWeeklyRentalInventory(weeklyRental);
    }
  }, [designSizeInventory, selectedWeekRange, rentals]); // rentals 의존성 추가

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 고객 데이터는 대여관리 UI에 있는 고객들만 가져오기
      // 일단 빈 배열로 설정 (대여 데이터 로드 후 업데이트)
      setCustomers([]);

      // 디자인+사이즈별 재고 데이터 가져오기
      const { data: designSizeData, error: designSizeError } = await supabase
        .from('design_size_inventory_2025_11_25_03_39')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('design_code', { ascending: true });
      
      if (designSizeError) throw designSizeError;
      setDesignSizeInventory(designSizeData || []);
      
      // 개별 아이템은 디자인+사이즈 데이터를 그대로 사용
      setClothingItems(designSizeData || []);

      // 대여 데이터 가져오기
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals_2025_11_25_03_39')
        .select(`
          *,
          customers_2025_11_21_07_27(*)
        `)
        .order('created_at', { ascending: false });
      
      if (rentalsError) throw rentalsError;
      setRentals(rentalsData || []);

      // 구매 데이터 가져오기
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('purchases_2025_11_28_07_30')
        .select(`
          *,
          customers_2025_11_21_07_27(*)
        `)
        .order('created_at', { ascending: false });
      
      if (purchasesError) throw purchasesError;
      setPurchases(purchasesData || []);
      
      // 출고 데이터 가져오기
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments_2025_11_28_10_15')
        .select(`
          *,
          customers_2025_11_21_07_27(*)
        `)
        .order('created_at', { ascending: false });
      
      if (shipmentsError) throw shipmentsError;
      setShipments(shipmentsData || []);
      setRentals(rentalsData || []);
      
      // 대여관리 UI에 있는 고객들만 추출하여 고객 목록 생성
      const uniqueCustomers = [];
      const customerIds = new Set();
      
      (rentalsData || []).forEach(rental => {
        if (rental.customers_2025_11_21_07_27 && !customerIds.has(rental.customer_id)) {
          customerIds.add(rental.customer_id);
          uniqueCustomers.push(rental.customers_2025_11_21_07_27);
        }
      });
      
      console.log(`대여관리 UI 기준 고객 수: ${uniqueCustomers.length}명`);
      uniqueCustomers.forEach(c => console.log(`- ${c.name} (ID: ${c.id})`));
      
      setCustomers(uniqueCustomers);
      
    } catch (error: any) {
      toast({
        title: '데이터 로딩 실패',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers_2025_11_21_07_27')
        .insert([{ ...newCustomer, company_id: '00000000-0000-0000-0000-000000000001' }])
        .select();
      
      if (error) throw error;
      
      setCustomers([...customers, data[0]]);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setIsCustomerDialogOpen(false);
      
      toast({
        title: '고객 추가 완료',
        description: '새 고객이 성공적으로 추가되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '고객 추가 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addDesignSize = async () => {
    try {
      const { data, error } = await supabase
        .from('design_size_inventory_2025_11_25_03_39')
        .insert([{
          ...newDesignSize,
          rented_quantity: 0,
          company_id: '00000000-0000-0000-0000-000000000001'
        }])
        .select();
      
      if (error) throw error;
      
      setDesignSizeInventory([...designSizeInventory, data[0]]);
      setNewDesignSize({
        design_code: '', design_name: '', size: '',
        rental_price: 0, total_quantity: 0, inventory_type: '대여용'
      });
      setIsDesignDialogOpen(false);
      
      toast({
        title: '디자인+사이즈 추가 완료',
        description: '새 디자인+사이즈가 성공적으로 추가되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '디자인+사이즈 추가 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addPurchase = async () => {
    try {
      // 입력 값 검증
      if (!newPurchase.customer_id || !newPurchase.design_code || !newPurchase.purchase_date) {
        toast({
          title: '입력 오류',
          description: '모든 필수 항목을 입력해주세요.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('purchases_2025_11_28_07_30')
        .insert([{ 
          ...newPurchase, 
          company_id: '00000000-0000-0000-0000-000000000001' 
        }])
        .select();
      
      if (error) throw error;
      
      // 구매 등록 후 재고 수량이 트리거에 의해 자동으로 업데이트됨
      // 트리거 실행 대기 후 데이터 새로고침
      setTimeout(async () => {
        await fetchData();
      }, 100);
      
      setNewPurchase({
        customer_id: '', design_code: '', design_name: '', size: '', quantity: 1,
        purchase_date: '', purchase_price: 0
      });
      setIsPurchaseDialogOpen(false);
      
      toast({
        title: '구매 등록 완료',
        description: '구매가 성공적으로 등록되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '구매 등록 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addClothingItem = async () => {
    try {
      const { data, error } = await supabase
        .from('clothing_items_2025_11_21_07_27')
        .insert([{
          ...newItem,
          status: newItem.inventory_type === '대여용' ? '대여가능' : '판매가능',
          company_id: '00000000-0000-0000-0000-000000000001'
        }])
        .select();
      
      if (error) throw error;
      
      setClothingItems([...clothingItems, data[0]]);
      setNewItem({
        item_code: '', name: '', category: '', season: '', brand: '', size: '', color: '',
        rental_price: 0, purchase_price: 0, condition: '양호', notes: '', inventory_type: '대여용', design_code: ''
      });
      setIsItemDialogOpen(false);
      
      toast({
        title: '아이템 추가 완료',
        description: '새 아이템이 성공적으로 추가되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '아이템 추가 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 구매 삭제 함수
  const deletePurchase = async (id: string) => {
    try {
      const { error } = await supabase
        .from('purchases_2025_11_28_07_30')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // 구매 삭제 후 데이터 새로고침
      await fetchData();
      
      toast({
        title: '구매 삭제 완료',
        description: '구매 기록이 성공적으로 삭제되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '구매 삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 출고 추가 함수
  const addShipment = async () => {
    try {
      console.log('출고 등록 시도:', newShipment);
      console.log('사용 가능한 고객 목록:', customers);
      console.log('사용 가능한 구매용 재고:', designSizeInventory.filter(item => item.inventory_type === '구매용'));
      // 필수 필드 검증
      if (!newShipment.customer_id || !newShipment.design_code || !newShipment.design_name || !newShipment.size || !newShipment.shipment_date) {
        toast({
          title: '입력 오류',
          description: '고객, 상품(코드, 이름, 사이즈), 출고일을 모두 입력해주세요.',
          variant: 'destructive',
        });
        return;
      }
      
      // 수량 검증
      if (!newShipment.quantity || newShipment.quantity <= 0) {
        toast({
          title: '수량 오류',
          description: '출고 수량은 1개 이상이어야 합니다.',
          variant: 'destructive',
        });
        return;
      }
      
      // 출고 가능 수량 검증
      const selectedItem = designSizeInventory.find(item => 
        item.inventory_type === '구매용' && 
        item.design_code === newShipment.design_code && 
        item.size === newShipment.size
      );
      
      if (selectedItem) {
        const availableToShip = (selectedItem.total_quantity || 0) - (selectedItem.shipped_quantity || 0);
        
        // 재고가 부족한 경우 경고 메시지만 표시 (출고는 가능)
        if (newShipment.quantity > availableToShip && availableToShip > 0) {
          toast({
            title: '재고 부족 경고',
            description: `재고: ${availableToShip}개, 요청: ${newShipment.quantity}개. 부족분은 제작 후 출고됩니다.`,
            variant: 'default', // 경고이므로 destructive 대신 default 사용
          });
        } else if (availableToShip <= 0) {
          toast({
            title: '제작 후 출고',
            description: `재고가 없어 제작 후 출고됩니다. 요청 수량: ${newShipment.quantity}개`,
            variant: 'default',
          });
        }
      }

      // 데이터베이스에 삽입할 데이터 준비
      const shipmentData = {
        ...newShipment,
        company_id: '00000000-0000-0000-0000-000000000001'
      };
      
      console.log('데이터베이스에 삽입할 데이터:', shipmentData);
      
      const { data, error } = await supabase
        .from('shipments_2025_11_28_10_15')
        .insert([shipmentData])
        .select();
      
      console.log('Supabase 응답:', { data, error });
      
      if (error) {
        console.error('데이터베이스 오류:', error);
        throw error;
      }
      
      // 출고 등록 후 재고 수량이 트리거에 의해 자동으로 업데이트됨
      // 트리거 실행 대기 후 데이터 새로고침
      setTimeout(async () => {
        await fetchData();
      }, 100);
      
      // 폼 초기화
      setNewShipment({
        customer_id: '', 
        design_code: '', 
        design_name: '', 
        size: '', 
        quantity: 1,
        shipment_date: new Date().toISOString().split('T')[0], // 오늘 날짜로 기본 설정
        tracking_number: '', 
        shipping_method: '택배', 
        status: '출고완료', 
        notes: ''
      });
      setIsShipmentDialogOpen(false);
      
      toast({
        title: '출고 등록 완료',
        description: '출고가 성공적으로 등록되었습니다.',
      });
    } catch (error: any) {
      console.error('출고 등록 오류:', error);
      
      let errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
      
      // 일반적인 오류 메시지 개선
      if (error.code === '23505') {
        errorMessage = '중복된 출고 데이터입니다.';
      } else if (error.code === '23503') {
        errorMessage = '참조된 데이터가 존재하지 않습니다. (고객 또는 상품 정보 확인)';
      } else if (error.code === '23502') {
        errorMessage = '필수 필드가 비어있습니다.';
      }
      
      toast({
        title: '출고 등록 실패',
        description: `${errorMessage} (코드: ${error.code || 'N/A'})`,
        variant: 'destructive',
      });
    }
  };

  // 출고 삭제 함수
  const deleteShipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shipments_2025_11_28_10_15')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // 출고 삭제 후 데이터 새로고침
      await fetchData();
      
      toast({
        title: '출고 삭제 완료',
        description: '출고 기록이 성공적으로 삭제되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '출고 삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 출고 업데이트 함수
  const updateShipment = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('shipments_2025_11_28_10_15')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      // 출고 업데이트 후 데이터 새로고침
      await fetchData();
      
      toast({
        title: '출고 수정 완료',
        description: '출고 정보가 성공적으로 수정되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '출고 수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addRental = async () => {
    try {
      const { data, error } = await supabase
        .from('rentals_2025_11_25_03_39')
        .insert([{ 
          ...newRental, 
          status: '대여중',
          company_id: '00000000-0000-0000-0000-000000000001'
        }])
        .select(`
          *,
          customers_2025_11_21_07_27(*)
        `);
      
      if (error) throw error;
      
      setRentals([...rentals, data[0]]);
      setNewRental({
        customer_id: '', design_code: '', design_name: '', size: '', quantity: 1,
        rental_date: '', return_due_date: '', rental_price: 0
      });
      setIsRentalDialogOpen(false);
      
      // 트리거 실행 대기 후 데이터 새로고침
      setTimeout(async () => {
        await fetchData();
      }, 100);
      
      toast({
        title: '대여 등록 완료',
        description: '새 대여가 성공적으로 등록되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '대여 등록 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 인라인 편집 기능
  const updateDesignSize = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('design_size_inventory_2025_11_25_03_39')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      // DB 업데이트 후 전체 데이터 새로고침 (DB 원본 그대로 표시)
      await fetchData();
      
      toast({
        title: '수정 완료',
        description: '데이터가 성공적으로 수정되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateCustomer = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('customers_2025_11_21_07_27')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      // DB 업데이트 후 전체 데이터 새로고침 (DB 원본 그대로 표시)
      await fetchData();
      
      toast({
        title: '수정 완료',
        description: '데이터가 성공적으로 수정되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateClothingItem = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('clothing_items_2025_11_21_07_27')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      // DB 업데이트 후 전체 데이터 새로고침 (DB 원본 그대로 표시)
      await fetchData();
      
      toast({
        title: '수정 완료',
        description: '데이터가 성공적으로 수정되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteClothingItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clothing_items_2025_11_21_07_27')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setClothingItems(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: '삭제 완료',
        description: '아이템이 삭제되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteDesignSize = async (id: string) => {
    try {
      const { error } = await supabase
        .from('design_size_inventory_2025_11_25_03_39')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // DB 삭제 후 전체 데이터 새로고침 (DB 원본 그대로 표시)
      await fetchData();
      
      toast({
        title: '삭제 완료',
        description: '디자인이 삭제되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 드래그 종료 핸들러
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = designSizeInventory.findIndex(item => item.id === active.id);
      const newIndex = designSizeInventory.findIndex(item => item.id === over.id);
      
      // 로컬 상태 업데이트 (즉시 시각적 피드백)
      const newArray = arrayMove(designSizeInventory, oldIndex, newIndex);
      setDesignSizeInventory(newArray);
      
      try {
        // DB에서 display_order 업데이트
        for (let i = 0; i < newArray.length; i++) {
          await supabase
            .from('design_size_inventory_2025_11_25_03_39')
            .update({ display_order: i })
            .eq('id', newArray[i].id);
        }
        
        toast({
          title: '순서 변경 완료',
          description: '아이템 순서가 성공적으로 변경되었습니다.',
        });
      } catch (error: any) {
        // 오류 시 원래 상태로 복구
        await fetchData();
        toast({
          title: '순서 변경 실패',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  // 주간 기준 대여용 재고 계산 함수
  const calculateWeeklyRentalInventory = (weekStart: Date, weekEnd: Date) => {
    const weeklyRentalData = designSizeInventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        // 주간 대여 예정 계산
        const weekRentals = rentals.filter(rental => {
          if (rental.design_code !== item.design_code || rental.size !== item.size) return false;
          
          const rentalDate = new Date(rental.rental_date);
          const returnDate = rental.return_date ? new Date(rental.return_date) : null;
          
          // 주간 내에 대여 중인 경우
          if (rental.status === '대여중' || rental.status === '연체') {
            // 대여일이 주간 이전이고 반납일이 주간 이후이거나 없는 경우
            if (rentalDate <= weekEnd && (!returnDate || returnDate >= weekStart)) {
              return true;
            }
          }
          
          return false;
        });
        
        const weeklyRented = weekRentals.length;
        const weeklyAvailable = Math.max(0, item.total_quantity - weeklyRented);
        
        return {
          ...item,
          weekly_rented_quantity: weeklyRented,
          weekly_available_quantity: weeklyAvailable
        };
      });
    
    return weeklyRentalData;
  };

  const updateRental = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('rentals_2025_11_25_03_39')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      // DB 업데이트 후 전체 데이터 새로고침 (DB 원본 그대로 표시)
      if (field === 'status') {
        // 트리거 실행 대기 후 데이터 새로고침
        setTimeout(async () => {
          await fetchData();
        }, 100);
      } else {
        // 일반 필드 수정은 즉시 새로고침
        await fetchData();
      }
      
      toast({
        title: '수정 완료',
        description: '대여 정보가 성공적으로 수정되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteRental = async (id: string) => {
    try {
      console.log(`대여 기록 삭제 시도: ${id}`);
      
      // 데이터베이스에서 완전 삭제
      const { error } = await supabase
        .from('rentals_2025_11_25_03_39')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // UI에서 제거
      setRentals(prev => prev.filter(item => item.id !== id));
      
      // 재고 수량 즉시 업데이트
      await fetchData();
      
      console.log(`대여 기록 삭제 완료: ${id}`);
      
      toast({
        title: '삭제 완료',
        description: '대여 기록이 데이터베이스에서 완전히 삭제되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      // ✅ UI 기준 삭제 검사: 화면에 보이는 대여 데이터만 확인
      const activeRentals = rentals.filter(rental => 
        rental.customer_id === id && rental.status === '대여중'
      );
      
      const customerName = customers.find(c => c.id === id)?.name || 'Unknown';
      console.log(`삭제 시도 - ${customerName}, UI 대여중: ${activeRentals.length}개`);
      
      if (activeRentals.length > 0) {
        toast({
          title: '삭제 불가',
          description: `UI에 보이는 대여중 아이템이 ${activeRentals.length}개 있어 삭제할 수 없습니다.`,
          variant: 'destructive',
        });
        return;
      }
      
      // UI에 대여중인 아이템이 없으므로 삭제 진행
      console.log(`삭제 진행 - ${customerName}: UI에 대여중 아이템 없음`);
      
      const { error } = await supabase
        .from('customers_2025_11_21_07_27')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // DB 삭제 후 전체 데이터 새로고침 (DB 원본 그대로 표시)
      await fetchData();
      
      toast({
        title: '삭제 완료',
        description: '고객이 삭제되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // CSV 가져오기 기능
  const importFromCSV = async () => {
    try {
      if (!csvData.trim()) {
        toast({
          title: '데이터 없음',
          description: 'CSV 데이터를 입력해주세요.',
          variant: 'destructive',
        });
        return;
      }

      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const importedItems = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        const item: any = {};
        headers.forEach((header, index) => {
          let value = values[index];
          
          if (header === 'rental_price' || header === 'total_quantity') {
            value = value.replace(/[^0-9]/g, '');
            item[header] = value ? parseInt(value) : 0;
          } else {
            item[header] = value;
          }
        });

        item.rented_quantity = 0;
        item.company_id = '00000000-0000-0000-0000-000000000001';
        importedItems.push(item);
      }

      const { data, error } = await supabase
        .from('design_size_inventory_2025_11_25_03_39')
        .insert(importedItems)
        .select();
      
      if (error) throw error;
      
      setDesignSizeInventory([...designSizeInventory, ...data]);
      setCsvData('');
      setIsImportDialogOpen(false);
      
      toast({
        title: 'CSV 가져오기 완료',
        description: `${data.length}개의 아이템이 성공적으로 가져와졌습니다.`,
      });
    } catch (error: any) {
      toast({
        title: 'CSV 가져오기 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">의류 대여 재고관리 시스템</h1>
          <p className="text-gray-600 mt-2">재고 관리 및 대여 현황 추적</p>
        </div>

        <Tabs defaultValue="weekly-calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="weekly-calendar">주간달력</TabsTrigger>
            <TabsTrigger value="rental-inventory">대여용재고</TabsTrigger>
            <TabsTrigger value="rentals">대여관리</TabsTrigger>
            <TabsTrigger value="purchase-inventory">구매용 재고</TabsTrigger>
            <TabsTrigger value="shipments">출고관리</TabsTrigger>
            <TabsTrigger value="purchases">구매관리</TabsTrigger>
            <TabsTrigger value="customers">고객관리</TabsTrigger>
            <TabsTrigger value="reports">통계리포트</TabsTrigger>
          </TabsList>

          {/* 주간 달력 탭 */}
          <TabsContent value="weekly-calendar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 달력 섹션 */}
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
                      selectedWeek: (date) => {
                        if (!selectedWeekRange) return false;
                        return date >= selectedWeekRange.start && date <= selectedWeekRange.end;
                      }
                    }}
                    modifiersClassNames={{
                      selectedWeek: 'rdp-day_selected_week'
                    }}
                  />
                </CardContent>
              </Card>
              
              {/* 주간 재고 현황 */}
              <Card>
                <CardHeader>
                  <CardTitle>주간 재고 현황</CardTitle>
                  <CardDescription>매주 초기화되는 재고 시스템 (화-일 대여, 월요일 반납)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                        <div className="font-semibold text-blue-800 mb-2">선택된 주간</div>
                        <div className="text-lg font-bold text-blue-600">
                          {selectedWeekRange ? 
                            `${selectedWeekRange.start.getFullYear()}년 ${selectedWeekRange.start.getMonth() + 1}월 ${selectedWeekRange.start.getDate()}일 ~ ${selectedWeekRange.end.getMonth() + 1}월 ${selectedWeekRange.end.getDate()}일` 
                            : '날짜를 선택하세요'
                          }
                        </div>
                        <div className="text-sm text-blue-500 mt-1">
                          매주 초기화되는 재고 시스템 (화-일 대여, 월요일 반납)
                        </div>
                      </div>
                    </div>
                    
                    {/* 마감된 디자인 리스트 */}
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-800 mb-3">마감된 디자인 리스트 (availability = 0)</h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        {(() => {
                          // availability = 0인 아이템들 필터링
                          const soldOutItems = (weeklyInventory || []).filter(item => item && item.finalAvailable === 0);
                          
                          if (soldOutItems.length === 0) {
                            return (
                              <div className="text-gray-500 text-sm text-center py-2">
                                마감된 디자인이 없습니다.
                              </div>
                            );
                          }
                          
                          return (
                            <div className="space-y-2">
                              {soldOutItems.map((item) => (
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
                                총 {soldOutItems.length}개 디자인이 마감되었습니다.
                              </div>
                            </div>
                          );
                        })()} 
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* 주간 상세 재고 테이블 */}
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
                          <TableCell>
                            <Badge variant="outline">{item.total_quantity}개</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-orange-100 text-orange-800">
                              {item.weekRentals}개
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800 font-bold">
                              {item.finalAvailable}개
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>CSV 데이터 가져오기</DialogTitle>
                  <DialogDescription>
                    CSV 형식의 데이터를 가져옵니다.
                    <br />
                    <strong>필수 컴럼:</strong> design_code, design_name, size, rental_price, total_quantity
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
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            setCsvData(content);
                          };
                          reader.readAsText(file, 'UTF-8');
                        }
                      }}
                      className="mb-2"
                    />
                    <p className="text-sm text-gray-500 mb-4">또는 아래에 직접 붙여넣기:</p>
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
            
            {/* 디자인 추가 다이얼로그 */}
            <Dialog open={isDesignDialogOpen} onOpenChange={setIsDesignDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 디자인+사이즈 추가</DialogTitle>
                  <DialogDescription>새로운 디자인+사이즈 조합을 등록합니다</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label htmlFor="design_code">상품코드</Label>
                    <Input
                      id="design_code"
                      value={newDesignSize.design_code}
                      onChange={(e) => setNewDesignSize({...newDesignSize, design_code: e.target.value})}
                      placeholder="예: TOP001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="design_name">디자인명</Label>
                    <Input
                      id="design_name"
                      value={newDesignSize.design_name}
                      onChange={(e) => setNewDesignSize({...newDesignSize, design_name: e.target.value})}
                      placeholder="예: 화이트 셔츠"
                    />
                  </div>
                  <div>
                    <Label htmlFor="size">사이즈</Label>
                    <Input
                      id="size"
                      value={newDesignSize.size}
                      onChange={(e) => setNewDesignSize({...newDesignSize, size: e.target.value})}
                      placeholder="예: M"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rental_price">대여료</Label>
                    <Input
                      id="rental_price"
                      type="number"
                      value={newDesignSize.rental_price}
                      onChange={(e) => setNewDesignSize({...newDesignSize, rental_price: Number(e.target.value)})}
                      placeholder="예: 15000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="total_quantity">총 수량</Label>
                    <Input
                      id="total_quantity"
                      type="number"
                      value={newDesignSize.total_quantity}
                      onChange={(e) => setNewDesignSize({...newDesignSize, total_quantity: Number(e.target.value)})}
                      placeholder="예: 5"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDesignDialogOpen(false)}>취소</Button>
                  <Button onClick={addDesignSize}>추가</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* 대여용 재고 관리 탭 */}
          <TabsContent value="rental-inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-blue-600">대여용 재고 관리</CardTitle>
                    <CardDescription>
                      선택된 주간 ({selectedWeekRange.start.toLocaleDateString('ko-KR')} ~ {selectedWeekRange.end.toLocaleDateString('ko-KR')}) 기준 대여용 재고를 관리합니다
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
                    </Dialog>
                    <Dialog open={isDesignDialogOpen} onOpenChange={setIsDesignDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          대여용 재고 추가
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>CSV 데이터 가져오기</DialogTitle>
                    <DialogDescription>
                      CSV 형식의 데이터를 가져옵니다.
                      <br />
                      <strong>필수 컴럼:</strong> design_code, design_name, size, rental_price, total_quantity
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
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const content = event.target?.result as string;
                              setCsvData(content);
                            };
                            reader.readAsText(file, 'UTF-8');
                          }
                        }}
                        className="mb-2"
                      />
                      <p className="text-sm text-gray-500 mb-4">또는 아래에 직접 붙여넣기:</p>
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
                        onChange={(e) => setNewDesignSize({...newDesignSize, design_code: e.target.value})}
                        placeholder="예: TOP001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="design_name">디자인명</Label>
                      <Input
                        id="design_name"
                        value={newDesignSize.design_name}
                        onChange={(e) => setNewDesignSize({...newDesignSize, design_name: e.target.value})}
                        placeholder="예: 화이트 셔츠"
                      />
                    </div>
                    <div>
                      <Label htmlFor="size">사이즈</Label>
                      <Input
                        id="size"
                        value={newDesignSize.size}
                        onChange={(e) => setNewDesignSize({...newDesignSize, size: e.target.value})}
                        placeholder="예: M"
                      />
                    </div>

                    <div>
                      <Label htmlFor="rental_price">대여료</Label>
                      <Input
                        id="rental_price"
                        type="number"
                        value={newDesignSize.rental_price}
                        onChange={(e) => setNewDesignSize({...newDesignSize, rental_price: Number(e.target.value)})}
                        placeholder="15000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="total_quantity">총 수량</Label>
                      <Input
                        id="total_quantity"
                        type="number"
                        value={newDesignSize.total_quantity}
                        onChange={(e) => setNewDesignSize({...newDesignSize, total_quantity: Number(e.target.value)})}
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="inventory_type">재고 타입</Label>
                      <Select value={newDesignSize.inventory_type} onValueChange={(value) => setNewDesignSize({...newDesignSize, inventory_type: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="재고 타입을 선택하세요" />
                        </SelectTrigger>
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
              <CardContent>
                <div className="overflow-x-auto">
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
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                      modifiers={[restrictToVerticalAxis]}
                    >
                      <TableBody>
                        <SortableContext 
                          items={weeklyRentalInventory.map(item => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {weeklyRentalInventory.map((design) => (
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
                    </DndContext>
                  </Table>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* 구매용 재고 관리 탭 */}
          <TabsContent value="purchase-inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-purple-600">구매용 재고 관리</CardTitle>
                    <CardDescription>판매 비즈니스용 재고를 관리합니다</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Upload className="h-4 w-4 mr-2" />
                          CSV 가져오기
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                    <Button onClick={() => {
                      setNewDesignSize({...newDesignSize, inventory_type: '구매용'});
                      setIsDesignDialogOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      구매용 재고 추가
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
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
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                      modifiers={[restrictToVerticalAxis]}
                    >
                      <TableBody>
                        <SortableContext 
                          items={designSizeInventory.filter(item => item.inventory_type === '구매용').map(item => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {(designSizeInventory || []).filter(item => item && item.inventory_type === '구매용').map((design) => (
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
                    </DndContext>
                  </Table>
                </div>
              </CardContent>
            </Card>
            
            {/* 구매용 재고 CSV 가져오기 다이얼로그 */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>CSV 데이터 가져오기</DialogTitle>
                  <DialogDescription>
                    CSV 형식의 데이터를 가져옵니다.
                    <br />
                    <strong>필수 컴럼:</strong> design_code, design_name, size, rental_price, total_quantity
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
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const csvText = event.target?.result as string;
                            setCsvData(csvText);
                          };
                          reader.readAsText(file);
                        }
                      }}
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
            
            {/* 구매용 재고 추가 다이얼로그 */}
            <Dialog open={isDesignDialogOpen} onOpenChange={setIsDesignDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 구매용 재고 추가</DialogTitle>
                  <DialogDescription>새로운 구매용 재고를 등록합니다</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="design_code">상품 코드</Label>
                    <Input
                      id="design_code"
                      value={newDesignSize.design_code}
                      onChange={(e) => setNewDesignSize({...newDesignSize, design_code: e.target.value})}
                      placeholder="예: SALE001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="design_name">디자인명</Label>
                    <Input
                      id="design_name"
                      value={newDesignSize.design_name}
                      onChange={(e) => setNewDesignSize({...newDesignSize, design_name: e.target.value})}
                      placeholder="예: 판매용 셔츠"
                    />
                  </div>
                  <div>
                    <Label htmlFor="size">사이즈</Label>
                    <Input
                      id="size"
                      value={newDesignSize.size}
                      onChange={(e) => setNewDesignSize({...newDesignSize, size: e.target.value})}
                      placeholder="예: L"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rental_price">판매가</Label>
                    <Input
                      id="rental_price"
                      type="number"
                      value={newDesignSize.rental_price}
                      onChange={(e) => setNewDesignSize({...newDesignSize, rental_price: Number(e.target.value)})}
                      placeholder="예: 25000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="total_quantity">총 수량</Label>
                    <Input
                      id="total_quantity"
                      type="number"
                      value={newDesignSize.total_quantity}
                      onChange={(e) => setNewDesignSize({...newDesignSize, total_quantity: Number(e.target.value)})}
                      placeholder="예: 10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="inventory_type">재고 타입</Label>
                    <Select value={newDesignSize.inventory_type} onValueChange={(value) => setNewDesignSize({...newDesignSize, inventory_type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="재고 타입을 선택하세요" />
                      </SelectTrigger>
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
          </TabsContent>

          {/* 출고 관리 탭 */}
          <TabsContent value="shipments" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-green-600">출고 관리</CardTitle>
                    <CardDescription>구매용 상품의 출고 및 배송을 관리합니다</CardDescription>
                  </div>
                  <Button onClick={() => {
                    // 출고 등록 다이얼로그 열 때 폼 초기화
                    setNewShipment({
                      customer_id: '', 
                      design_code: '', 
                      design_name: '', 
                      size: '', 
                      quantity: 1,
                      shipment_date: new Date().toISOString().split('T')[0], // 오늘 날짜로 기본 설정
                      tracking_number: '', 
                      shipping_method: '택배', 
                      status: '출고완료', 
                      notes: ''
                    });
                    setIsShipmentDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    출고 등록
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
                        <TableHead>총수량</TableHead>
                        <TableHead>판매됨</TableHead>
                        <TableHead>출고완료</TableHead>
                        <TableHead>ATS</TableHead>
                        <TableHead>출고대기</TableHead>
                        <TableHead>즉시출고가능</TableHead>
                        <TableHead>주문필요량</TableHead>
                        <TableHead>액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {designSizeInventory.filter(item => item.inventory_type === '구매용').length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-muted-foreground">
                            구매용 재고가 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        designSizeInventory.filter(item => item.inventory_type === '구매용').map((design) => (
                          <TableRow key={design.id}>
                            <TableCell>
                              <EditableCell
                                value={design.design_code}
                                type="text"
                                onSave={(value) => updateDesignSize(design.id, 'design_code', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={design.design_name}
                                type="text"
                                onSave={(value) => updateDesignSize(design.id, 'design_name', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={design.size}
                                type="text"
                                onSave={(value) => updateDesignSize(design.id, 'size', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={design.total_quantity}
                                type="number"
                                onSave={(value) => updateDesignSize(design.id, 'total_quantity', Number(value))}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-red-50 text-red-400">{design.sold_quantity || 0}개</Badge>
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={design.shipped_quantity || 0}
                                type="number"
                                onSave={(value) => updateDesignSize(design.id, 'shipped_quantity', Number(value))}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-blue-50 text-blue-400">{design.available_for_sale || 0}개</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-orange-50 text-orange-400">{design.outstanding_shipment || 0}개</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-50 text-green-400">{design.shippable || 0}개</Badge>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const orderRequired = design.order_required || 0;
                                return (
                                  <Badge 
                                    className={orderRequired > 0 ? "bg-red-100 text-red-800 font-bold" : "bg-gray-100 text-gray-600"}
                                  >
                                    {orderRequired}개
                                  </Badge>
                                );
                              })()} 
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteDesignSize(design.id)}
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

            {/* 출고 등록 다이얼로그 */}
            <Dialog open={isShipmentDialogOpen} onOpenChange={setIsShipmentDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>출고 등록</DialogTitle>
                  <DialogDescription>
                    구매용 상품의 출고를 등록합니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="customer">고객</Label>
                    <Select value={newShipment.customer_id} onValueChange={(value) => setNewShipment({...newShipment, customer_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="고객을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.phone})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="shipment_item">출고 상품</Label>
                    <Select 
                      value={newShipment.design_code && newShipment.size ? `${newShipment.design_code}-${newShipment.size}` : ""} 
                      onValueChange={(value) => {
                        if (value === "none") {
                          setNewShipment({
                            ...newShipment,
                            design_code: '',
                            design_name: '',
                            size: ''
                          });
                          return;
                        }
                        const selectedItem = designSizeInventory.find(item => 
                          item.inventory_type === '구매용' && `${item.design_code}-${item.size}` === value
                        );
                        if (selectedItem) {
                          setNewShipment({
                            ...newShipment,
                            design_code: selectedItem.design_code,
                            design_name: selectedItem.design_name,
                            size: selectedItem.size
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="출고할 상품을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">상품을 선택하세요</SelectItem>
                        {designSizeInventory
                          .filter(item => item.inventory_type === '구매용')
                          .map((item) => {
                            const availableToShip = (item.total_quantity || 0) - (item.shipped_quantity || 0);
                            const needProduction = availableToShip <= 0;
                            const stockText = needProduction 
                              ? `(제작필요: 1벌)` 
                              : `(출고가능: ${availableToShip}벌)`;
                            
                            return (
                              <SelectItem key={item.id} value={`${item.design_code}-${item.size}`}>
                                {item.design_name} ({item.size}) {stockText}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">수량</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={newShipment.quantity}
                        onChange={(e) => setNewShipment({...newShipment, quantity: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="shipment_date">출고일</Label>
                      <Input
                        id="shipment_date"
                        type="date"
                        value={newShipment.shipment_date}
                        onChange={(e) => setNewShipment({...newShipment, shipment_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tracking_number">송장번호</Label>
                      <Input
                        id="tracking_number"
                        value={newShipment.tracking_number}
                        onChange={(e) => setNewShipment({...newShipment, tracking_number: e.target.value})}
                        placeholder="예: TK1234567890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="shipping_method">배송방법</Label>
                      <Select value={newShipment.shipping_method} onValueChange={(value) => setNewShipment({...newShipment, shipping_method: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="택배">택배</SelectItem>
                          <SelectItem value="등기">등기</SelectItem>
                          <SelectItem value="직접수령">직접수령</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="status">상태</Label>
                    <Select value={newShipment.status} onValueChange={(value) => setNewShipment({...newShipment, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="출고대기">출고대기</SelectItem>
                        <SelectItem value="출고완료">출고완료</SelectItem>
                        <SelectItem value="배송중">배송중</SelectItem>
                        <SelectItem value="배송완료">배송완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notes">메모</Label>
                    <Input
                      id="notes"
                      value={newShipment.notes}
                      onChange={(e) => setNewShipment({...newShipment, notes: e.target.value})}
                      placeholder="추가 메모 (선택사항)"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsShipmentDialogOpen(false)}>취소</Button>
                  <Button onClick={addShipment}>등록</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* 출고 기록 테이블 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-green-600">출고 기록</CardTitle>
                <CardDescription>출고된 상품들의 배송 현황을 확인합니다</CardDescription>
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
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            출고 기록이 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        shipments.map((shipment) => (
                          <TableRow key={shipment.id}>
                            <TableCell>
                              <EditableCell
                                value={shipment.design_code}
                                type="text"
                                onSave={(value) => updateShipment(shipment.id, 'design_code', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={shipment.design_name}
                                type="text"
                                onSave={(value) => updateShipment(shipment.id, 'design_name', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={shipment.size}
                                type="text"
                                onSave={(value) => updateShipment(shipment.id, 'size', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={shipment.quantity}
                                type="number"
                                onSave={(value) => updateShipment(shipment.id, 'quantity', Number(value))}
                              />
                            </TableCell>
                            <TableCell>{shipment.customers_2025_11_21_07_27?.name || '-'}</TableCell>
                            <TableCell>
                              <EditableCell
                                value={shipment.shipment_date}
                                type="date"
                                onSave={(value) => updateShipment(shipment.id, 'shipment_date', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={shipment.tracking_number || ''}
                                type="text"
                                onSave={(value) => updateShipment(shipment.id, 'tracking_number', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={shipment.shipping_method}
                                type="select"
                                options={['택배', '등기', '직접수령']}
                                onSave={(value) => updateShipment(shipment.id, 'shipping_method', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <EditableCell
                                value={shipment.status}
                                type="select"
                                options={['출고대기', '출고완료', '배송중', '배송완료']}
                                onSave={(value) => updateShipment(shipment.id, 'status', value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteShipment(shipment.id)}
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
          </TabsContent>

          {/* 개별 아이템 관리 탭 */}
          <TabsContent value="individual-items" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>개별 아이템 관리</CardTitle>
                    <CardDescription>디자인+사이즈별 재고의 상세 정보를 확인합니다</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>디자인코드</TableHead>
                        <TableHead>디자인명</TableHead>
                        <TableHead>사이즈</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>대여료</TableHead>
                        <TableHead>총 수량</TableHead>
                        <TableHead>대여가능</TableHead>
                        <TableHead>대여중</TableHead>
                        <TableHead>이용율</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clothingItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.design_code}</TableCell>
                          <TableCell>{item.design_name}</TableCell>
                          <TableCell>{item.size}</TableCell>
                          <TableCell>
                            <EditableCell
                              value={item.condition || '좋음'}
                              type="select"
                              options={['좋음', '보통', '나쁨']}
                              onSave={(value) => updateDesignSize(item.id, 'condition', value)}
                            />
                          </TableCell>
                          <TableCell>{item.rental_price?.toLocaleString()}원</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.total_quantity}개</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">
                              {item.available_quantity}개
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800">
                              {item.rented_quantity}개
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const utilizationRate = item.total_quantity > 0 
                                ? Math.round((item.rented_quantity / item.total_quantity) * 100)
                                : 0;
                              
                              return (
                                <div className="w-full space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span>{utilizationRate}%</span>
                                  </div>
                                  <Progress 
                                    value={utilizationRate} 
                                    className="h-2"
                                  />
                                </div>
                              );
                            })()} 
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 대여 관리 탭 */}
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
                        // 대여 등록 다이얼로그 열 때 폼 초기화
                        setNewRental({
                          customer_id: '', 
                          design_code: '', 
                          design_name: '', 
                          size: '', 
                          quantity: 1,
                          rental_date: '', 
                          return_due_date: '', 
                          rental_price: 0
                        });
                        setRentalWeeklyInventory([]);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        대여 등록
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>새 대여 등록</DialogTitle>
                        <DialogDescription>새로운 대여를 등록합니다</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="customer">고객</Label>
                          <Select value={newRental.customer_id} onValueChange={(value) => setNewRental({...newRental, customer_id: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="고객 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name} ({customer.phone})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="design_size">디자인+사이즈 (선택된 주간 대여가능)</Label>
                          {!newRental.rental_date ? (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                              대여일을 먼저 선택해주세요. 해당 주간의 대여 가능한 재고를 보여드립니다.
                            </div>
                          ) : (
                            <>
                              {rentalWeeklyInventory.length === 0 ? (
                                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                                  선택된 주간에 대여 가능한 재고가 없습니다.
                                </div>
                              ) : (
                                <Select value={`${newRental.design_code}-${newRental.size}`} onValueChange={(value) => {
                                  const [design_code, size] = value.split('-');
                                  const designSize = rentalWeeklyInventory.find(d => d.design_code === design_code && d.size === size);
                                  setNewRental({
                                    ...newRental, 
                                    design_code,
                                    design_name: designSize?.design_name || '',
                                    size,
                                    rental_price: designSize?.rental_price || 0
                                  });
                                }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="대여 가능한 디자인+사이즈 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rentalWeeklyInventory.map((design) => (
                                      <SelectItem key={`${design.design_code}-${design.size}`} value={`${design.design_code}-${design.size}`}>
                                        {design.design_name} ({design.size}) - 대여가능: {design.finalAvailable}개
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="quantity">대여 수량</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={newRental.quantity}
                            onChange={(e) => setNewRental({...newRental, quantity: Number(e.target.value)})}
                            placeholder="1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="rental_date">대여일</Label>
                            <Input
                              id="rental_date"
                              type="date"
                              value={newRental.rental_date}
                              onChange={(e) => {
                                try {
                                  const newDate = e.target.value;
                                  console.log('대여일 선택:', newDate);
                                  setNewRental({...newRental, rental_date: newDate, design_code: '', design_name: '', size: '', rental_price: 0});
                                  
                                  // 데이터가 로드된 후에만 계산 실행
                                  if (designSizeInventory && designSizeInventory.length > 0) {
                                    calculateRentalWeeklyInventory(newDate);
                                  } else {
                                    console.log('데이터 로딩 대기 중...');
                                    setRentalWeeklyInventory([]);
                                  }
                                } catch (error) {
                                  console.error('대여일 선택 오류:', error);
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label htmlFor="return_due_date">반납예정일</Label>
                            <Input
                              id="return_due_date"
                              type="date"
                              value={newRental.return_due_date}
                              onChange={(e) => setNewRental({...newRental, return_due_date: e.target.value})}
                            />
                          </div>
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

          {/* 구매 등록 다이얼로그 */}
          <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 구매 등록</DialogTitle>
                <DialogDescription>새로운 구매를 등록합니다</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customer">고객</Label>
                  <Select value={newPurchase.customer_id} onValueChange={(value) => setNewPurchase({...newPurchase, customer_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="고객을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="purchase_date">구매일</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={newPurchase.purchase_date}
                    onChange={(e) => setNewPurchase({...newPurchase, purchase_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="purchase_item">구매용 상품</Label>
                  <Select 
                    value={`${newPurchase.design_code}-${newPurchase.size}`} 
                    onValueChange={(value) => {
                      const selectedItem = designSizeInventory.find(item => 
                        item.inventory_type === '구매용' && `${item.design_code}-${item.size}` === value
                      );
                      if (selectedItem) {
                        setNewPurchase({
                          ...newPurchase,
                          design_code: selectedItem.design_code,
                          design_name: selectedItem.design_name,
                          size: selectedItem.size,
                          purchase_price: selectedItem.rental_price
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="구매용 상품을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {designSizeInventory
                        .filter(item => item.inventory_type === '구매용')
                        .map((item) => {
                          const availableStock = item.available_for_sale || 0;
                          const needProduction = availableStock <= 0;
                          const stockText = needProduction 
                            ? `(제작필요: 1벌)` 
                            : `(재고: ${availableStock}벌)`;
                          
                          return (
                            <SelectItem key={item.id} value={`${item.design_code}-${item.size}`}>
                              {item.design_name} ({item.size}) {stockText}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">수량</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newPurchase.quantity}
                      onChange={(e) => setNewPurchase({...newPurchase, quantity: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase_price">구매가</Label>
                    <Input
                      id="purchase_price"
                      type="number"
                      value={newPurchase.purchase_price}
                      onChange={(e) => setNewPurchase({...newPurchase, purchase_price: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>취소</Button>
                <Button onClick={addPurchase}>등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                      {rentals.map((rental) => (
                        <TableRow key={rental.id}>
                          <TableCell>{rental.customers_2025_11_21_07_27?.name}</TableCell>
                          <TableCell>
                            <EditableCell
                              value={rental.design_name}
                              type="text"
                              onSave={(value) => updateRental(rental.id, 'design_name', value)}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={rental.size}
                              type="text"
                              onSave={(value) => updateRental(rental.id, 'size', value)}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={rental.quantity}
                              type="number"
                              onSave={(value) => updateRental(rental.id, 'quantity', Number(value))}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={rental.rental_date}
                              type="date"
                              onSave={(value) => updateRental(rental.id, 'rental_date', value)}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={rental.return_due_date}
                              type="date"
                              onSave={(value) => updateRental(rental.id, 'return_due_date', value)}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={rental.rental_price}
                              type="number"
                              onSave={(value) => updateRental(rental.id, 'rental_price', Number(value))}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={rental.status}
                              type="select"
                              options={['대여중', '반납완료', '연체']}
                              onSave={(value) => updateRental(rental.id, 'status', value)}
                            />
                          </TableCell>
                          <TableCell>
                            {rental.status === '반납완료' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteRental(rental.id)}
                                className="text-red-600 hover:text-red-800"
                              >
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

          {/* 구매 관리 탭 */}
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
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        구매 등록
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>새 구매 등록</DialogTitle>
                        <DialogDescription>새로운 구매를 등록합니다</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="customer">고객</Label>
                          <Select value={newPurchase.customer_id} onValueChange={(value) => setNewPurchase({...newPurchase, customer_id: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="고객을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="purchase_date">구매일</Label>
                          <Input
                            id="purchase_date"
                            type="date"
                            value={newPurchase.purchase_date}
                            onChange={(e) => setNewPurchase({...newPurchase, purchase_date: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="purchase_item">구매용 상품</Label>
                          <Select 
                            value={`${newPurchase.design_code}-${newPurchase.size}`} 
                            onValueChange={(value) => {
                              const selectedItem = designSizeInventory.find(item => 
                                item.inventory_type === '구매용' && `${item.design_code}-${item.size}` === value
                              );
                              if (selectedItem) {
                                setNewPurchase({
                                  ...newPurchase,
                                  design_code: selectedItem.design_code,
                                  design_name: selectedItem.design_name,
                                  size: selectedItem.size,
                                  purchase_price: selectedItem.rental_price
                                });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="구매용 상품을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              {designSizeInventory
                                .filter(item => item.inventory_type === '구매용')
                                .map((item) => {
                                  const availableStock = item.available_for_sale || 0;
                                  const needProduction = availableStock <= 0;
                                  const stockText = needProduction 
                                    ? `(제작필요: 1벌)` 
                                    : `(재고: ${availableStock}벌)`;
                                  
                                  return (
                                    <SelectItem key={item.id} value={`${item.design_code}-${item.size}`}>
                                      {item.design_name} ({item.size}) {stockText}
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="quantity">수량</Label>
                            <Input
                              id="quantity"
                              type="number"
                              min="1"
                              value={newPurchase.quantity}
                              onChange={(e) => setNewPurchase({...newPurchase, quantity: Number(e.target.value)})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="purchase_price">구매가</Label>
                            <Input
                              id="purchase_price"
                              type="number"
                              value={newPurchase.purchase_price}
                              onChange={(e) => setNewPurchase({...newPurchase, purchase_price: Number(e.target.value)})}
                            />
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
                        <TableHead>판매됨</TableHead>
                        <TableHead>판매가능</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            구매 기록이 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchases.map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell>
                              <span className="font-medium">{purchase.design_name}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{purchase.size}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-purple-100 text-purple-800">{purchase.quantity}개</Badge>
                            </TableCell>
                            <TableCell>
                              {purchase.customers_2025_11_21_07_27?.name || '미지정'}
                            </TableCell>
                            <TableCell>
                              {purchase.purchase_date}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{(purchase.purchase_price || 0).toLocaleString()}원</span>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const relatedItem = designSizeInventory.find(item => 
                                  item.design_code === purchase.design_code && 
                                  item.size === purchase.size && 
                                  item.inventory_type === '구매용'
                                );
                                return (
                                  <Badge className="bg-red-100 text-red-800">
                                    {relatedItem?.sold_quantity || 0}개
                                  </Badge>
                                );
                              })()} 
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const relatedItem = designSizeInventory.find(item => 
                                  item.design_code === purchase.design_code && 
                                  item.size === purchase.size && 
                                  item.inventory_type === '구매용'
                                );
                                return (
                                  <Badge className="bg-blue-100 text-blue-800">
                                    {relatedItem?.available_for_sale || relatedItem?.total_quantity || 0}개
                                  </Badge>
                                );
                              })()} 
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={purchase.status === '구매완료' ? 'default' : 
                                        purchase.status === '취소' ? 'destructive' : 'secondary'}
                              >
                                {purchase.status || '구매완료'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deletePurchase(purchase.id)}
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
          </TabsContent>

          {/* 고객 관리 탭 */}
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
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        고객 추가
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>새 고객 추가</DialogTitle>
                        <DialogDescription>새로운 고객을 등록합니다</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">이름</Label>
                          <Input
                            id="name"
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                            placeholder="고객 이름"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">전화번호</Label>
                          <Input
                            id="phone"
                            value={newCustomer.phone}
                            onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                            placeholder="010-0000-0000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">이메일</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newCustomer.email}
                            onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                            placeholder="customer@email.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="address">주소</Label>
                          <Input
                            id="address"
                            value={newCustomer.address}
                            onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                            placeholder="고객 주소"
                          />
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
                      {customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <EditableCell
                              value={customer.name}
                              type="text"
                              onSave={(value) => updateCustomer(customer.id, 'name', value)}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={customer.phone}
                              type="text"
                              onSave={(value) => updateCustomer(customer.id, 'phone', value)}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={customer.email}
                              type="text"
                              onSave={(value) => updateCustomer(customer.id, 'email', value)}
                            />
                          </TableCell>
                          <TableCell>
                            <EditableCell
                              value={customer.address}
                              type="text"
                              onSave={(value) => updateCustomer(customer.id, 'address', value)}
                            />
                          </TableCell>
                          <TableCell>
                            {(() => {
                              // 현재 화면에 보이는 rentals 배열에서 대여중 찾기
                              const activeRentals = rentals.filter(rental => {
                                const isMatch = rental.customer_id === customer.id;
                                const isActive = rental.status === '대여중';
                                return isMatch && isActive;
                              });
                              
                              // 디버깅 로그 (상세)
                              console.log(`
=== 고객 상태 확인 ===
고객명: ${customer.name}
고객 ID: ${customer.id}
전체 대여 건수: ${rentals.length}
이 고객 대여중: ${activeRentals.length}개
`);
                              if (activeRentals.length > 0) {
                                console.log('대여중 아이템:');
                                activeRentals.forEach(r => console.log(`- ${r.design_name} (${r.size})`));
                              }
                              
                              // UI 기준 판단: 대여중인 아이템이 있으면 삭제 불가
                              if (activeRentals.length > 0) {
                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge className="bg-blue-100 text-blue-800">
                                      대여중 ({activeRentals.length})
                                    </Badge>
                                    <span className="text-xs text-gray-500">삭제불가</span>
                                  </div>
                                );
                              }
                              
                              // 대여중인 아이템이 없으므로 삭제 가능
                              console.log(`${customer.name}: 삭제 가능 (대여중 0개)`);
                              
                              return (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    console.log(`삭제 버튼 클릭: ${customer.name}`);
                                    deleteCustomer(customer.id);
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              );
                            })()} 
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 통계 리포트 탭 - 디자인별 재고 데이터 기준 */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* 대여 현황 통계 - 디자인별 재고 기준 */}
              <Card>
                <CardHeader>
                  <CardTitle>대여 현황 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded">
                        <div className="text-2xl font-bold text-blue-600">
                          {designSizeInventory.reduce((sum, item) => sum + item.rented_quantity, 0)}
                        </div>
                        <div className="text-sm text-gray-600">현재 대여중</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {designSizeInventory.reduce((sum, item) => sum + (item.rented_quantity * item.rental_price), 0).toLocaleString()}원
                        </div>
                        <div className="text-sm text-gray-600">예상 매출</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">대여중 아이템 현황</h4>
                      <div className="space-y-2">
                        {designSizeInventory
                          .filter(item => item.rented_quantity > 0)
                          .map(item => (
                            <div key={item.id} className="flex justify-between items-center p-2 bg-blue-50 rounded text-sm">
                              <span>{item.design_name} ({item.size})</span>
                              <span className="text-blue-600">대여중: {item.rented_quantity}개</span>
                            </div>
                          ))
                        }
                        {designSizeInventory.filter(item => item.rented_quantity > 0).length === 0 && (
                          <div className="text-gray-500 text-sm">대여중인 아이템이 없습니다.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 수익 분석 */}
              <Card>
                <CardHeader>
                  <CardTitle>수익 분석</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="text-center p-4 bg-purple-50 rounded">
                        <div className="text-2xl font-bold text-purple-600">
                          {designSizeInventory.reduce((sum, item) => sum + (item.rented_quantity * item.rental_price), 0).toLocaleString()}원
                        </div>
                        <div className="text-sm text-gray-600">총 대여 매출</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-gray-600">
                          {designSizeInventory.length > 0 ? Math.round(designSizeInventory.reduce((sum, item) => sum + item.rental_price, 0) / designSizeInventory.length).toLocaleString() : 0}원
                        </div>
                        <div className="text-sm text-gray-600">평균 대여료</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">대여율 높은 아이템 TOP 5</h4>
                      <div className="space-y-2">
                        {designSizeInventory
                          .filter(item => item.total_quantity > 0)
                          .map(item => ({
                            ...item,
                            utilizationRate: Math.round((item.rented_quantity / item.total_quantity) * 100)
                          }))
                          .sort((a, b) => b.utilizationRate - a.utilizationRate)
                          .slice(0, 5)
                          .map((item, index) => (
                            <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                              <span>{index + 1}. {item.design_name} ({item.size})</span>
                              <span className="font-medium">이용율 {item.utilizationRate}%</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;