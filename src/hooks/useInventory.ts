import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { useToast } from '@/hooks/use-toast';
import { Customer, DesignSizeInventory, Rental, Purchase, Shipment, WeekRange } from '@/types';

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

// 주간 슬롯(월~일) 기준으로 “하루라도 겹치면” 재고 차감
// 취소만 제외하고 나머지는 전부 슬롯 소비(요구사항)
const ACTIVE_RENTAL_STATUSES = ['대여예정', '출고완료', '대여중', '반납완료', '연체'];

export const useInventory = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  // Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [designSizeInventory, setDesignSizeInventory] = useState<DesignSizeInventory[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);

  // Computed States
  const [weeklyInventorySoldOut, setWeeklyInventorySoldOut] = useState<DesignSizeInventory[]>([]);
  const [allWeeklyInventory, setAllWeeklyInventory] = useState<DesignSizeInventory[]>([]);
  const [weeklyRentalInventory, setWeeklyRentalInventory] = useState<DesignSizeInventory[]>([]);
  const [rentalWeeklyInventory, setRentalWeeklyInventory] = useState<DesignSizeInventory[]>([]);

  // Helpers
  const getWeekRange = (date: Date): WeekRange => {
    const monday = new Date(date);
    const day = date.getDay() || 7; // Sun(0)->7
    monday.setDate(date.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday, end: sunday };
  };

  const calculateWeeklyInventory = useCallback((
    startDate: Date,
    endDate: Date,
    inventory: DesignSizeInventory[],
    rentalsData: Rental[]
  ) => {
    const sDate = new Date(startDate);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(endDate);
    eDate.setHours(23, 59, 59, 999);

    const weeklyData = inventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const totalAvailable = item.total_quantity || 0;

        const weekRentalsQty = rentalsData
          .filter(r => {
            const status = (r.status || '').trim();
            // “취소”만 제외하고 싶으면 아래처럼 바꿔도 됨:
            // if (status === '취소') return false;
            if (!ACTIVE_RENTAL_STATUSES.includes(status)) return false;

            const rCode = (r.design_code || '').trim().toLowerCase();
            const iCode = (item.design_code || '').trim().toLowerCase();
            if (rCode !== iCode) return false;

            const rSize = (r.size || '').trim().toLowerCase();
            const iSize = (item.size || '').trim().toLowerCase();
            if (rSize !== iSize) return false;

            const rentalStart = new Date(r.rental_date);
            rentalStart.setHours(0, 0, 0, 0);

            const rentalEnd = r.return_due_date ? new Date(r.return_due_date) : new Date(r.rental_date);
            rentalEnd.setHours(23, 59, 59, 999);

            // 겹침 체크 (하루라도 포함되면 true)
            return rentalStart <= eDate && rentalEnd >= sDate;
          })
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        const finalAvailable = Math.max(0, totalAvailable - weekRentalsQty);

        return {
          ...item,
          weekRentals: weekRentalsQty,
          weekReturned: 0,
          finalAvailable,
        };
      });

    setAllWeeklyInventory(weeklyData);
    setWeeklyInventorySoldOut(weeklyData.filter(x => x.finalAvailable === 0));
  }, []);

  const calculateWeeklyRentalInventory = useCallback((
    weekStart: Date,
    weekEnd: Date,
    inventory: DesignSizeInventory[],
    rentalsData: Rental[]
  ) => {
    const sDate = new Date(weekStart);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(weekEnd);
    eDate.setHours(23, 59, 59, 999);

    return inventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const overlappedQty = rentalsData
          .filter(r => {
            const status = (r.status || '').trim();
            if (!ACTIVE_RENTAL_STATUSES.includes(status)) return false;

            const rCode = (r.design_code || '').trim().toLowerCase();
            const iCode = (item.design_code || '').trim().toLowerCase();
            if (rCode !== iCode) return false;

            const rSize = (r.size || '').trim().toLowerCase();
            const iSize = (item.size || '').trim().toLowerCase();
            if (rSize !== iSize) return false;

            const rentalStart = new Date(r.rental_date);
            rentalStart.setHours(0, 0, 0, 0);
            const rentalEnd = r.return_due_date ? new Date(r.return_due_date) : new Date(r.rental_date);
            rentalEnd.setHours(23, 59, 59, 999);

            return rentalStart <= eDate && rentalEnd >= sDate;
          })
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        const weeklyAvailable = Math.max(0, (item.total_quantity || 0) - overlappedQty);

        return {
          ...item,
          weekly_rented_quantity: overlappedQty,
          weekly_available_quantity: weeklyAvailable,
        };
      });
  }, []);

  const calculateRentalWeeklyInventory = useCallback((rentalDate: string) => {
    try {
      if (!rentalDate) {
        setRentalWeeklyInventory([]);
        return;
      }
      if (!designSizeInventory.length || !Array.isArray(rentals)) {
        setRentalWeeklyInventory([]);
        return;
      }

      const selected = new Date(rentalDate);
      selected.setHours(0, 0, 0, 0);

      const { start: monday, end: sunday } = getWeekRange(selected);

      const weeklyData = designSizeInventory
        .filter(item => item.inventory_type === '대여용')
        .map(item => {
          const weekRentalsQty = rentals
            .filter(r => {
              const status = (r.status || '').trim();
              if (!ACTIVE_RENTAL_STATUSES.includes(status)) return false;

              const rCode = (r.design_code || '').trim().toLowerCase();
              const iCode = (item.design_code || '').trim().toLowerCase();
              if (rCode !== iCode) return false;

              const rSize = (r.size || '').trim().toLowerCase();
              const iSize = (item.size || '').trim().toLowerCase();
              if (rSize !== iSize) return false;

              const rentalStart = new Date(r.rental_date);
              rentalStart.setHours(0, 0, 0, 0);
              const rentalEnd = r.return_due_date ? new Date(r.return_due_date) : new Date(r.rental_date);
              rentalEnd.setHours(23, 59, 59, 999);

              return rentalStart <= sunday && rentalEnd >= monday;
            })
            .reduce((sum, r) => sum + (r.quantity || 0), 0);

          const finalAvailable = Math.max(0, (item.total_quantity || 0) - weekRentalsQty);
          return { ...item, weekRentals: weekRentalsQty, finalAvailable };
        })
        .filter(x => (x.finalAvailable || 0) > 0);

      setRentalWeeklyInventory(weeklyData);
    } catch (e) {
      console.error('Error calculating rental weekly inventory:', e);
      setRentalWeeklyInventory([]);
    }
  }, [designSizeInventory, rentals]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: designSizeData, error: designSizeError } = await supabase
        .from('design_size_inventory')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('design_code', { ascending: true });
      if (designSizeError) throw designSizeError;

      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select(`*, customers(*)`)
        .order('created_at', { ascending: false });
      if (rentalsError) throw rentalsError;

      const { data: purchasesData, error: purchasesError } = await supabase
        .from('purchases')
        .select(`*, customers(*)`)
        .order('created_at', { ascending: false });
      if (purchasesError) throw purchasesError;

      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select(`*, customers(*)`)
        .order('created_at', { ascending: false });
      if (shipmentsError) throw shipmentsError;

      // ✅ 고객은 customers 테이블에서 “전체”를 가져와야 함
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (customersError) throw customersError;

      setDesignSizeInventory((designSizeData as DesignSizeInventory[]) || []);
      setRentals((rentalsData as unknown as Rental[]) || []);
      setPurchases((purchasesData as unknown as Purchase[]) || []);
      setShipments((shipmentsData as unknown as Shipment[]) || []);
      setCustomers((customersData as Customer[]) || []);

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

  useEffect(() => {
    fetchData();
  }, []);

  return {
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
    setShipments,
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
  };
};