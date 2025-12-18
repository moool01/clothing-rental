import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/supabase_client";
import { useToast } from '@/hooks/use-toast';
import { Customer, DesignSizeInventory, Rental, Purchase, Shipment, WeekRange } from '@/types';

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

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
    monday.setDate(date.getDate() - date.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  };

  const calculateWeeklyInventory = useCallback((startDate: Date, endDate: Date, inventory: DesignSizeInventory[], rentalsData: Rental[]) => {
    const weeklyData = inventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const totalAvailable = item.total_quantity;

        const tuesday = new Date(startDate);
        tuesday.setDate(startDate.getDate() + 1);

        const weekRentalsQty = rentalsData
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

        const monday = new Date(startDate);
        const weekReturnedQty = rentalsData
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
  }, []);

  const calculateWeeklyRentalInventory = useCallback((weekStart: Date, weekEnd: Date, inventory: DesignSizeInventory[], rentalsData: Rental[]) => {
    return inventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const overlappedQty = rentalsData
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

      setDesignSizeInventory(designSizeData as DesignSizeInventory[] || []);
      setRentals((rentalsData as unknown as Rental[]) || []);
      setPurchases((purchasesData as unknown as Purchase[]) || []);
      setShipments((shipmentsData as unknown as Shipment[]) || []);

      const map = new Map<string, Customer>();
      (rentalsData as unknown as Rental[] | null || []).forEach(r => {
        if (r.customer_id && r.customers && !map.has(r.customer_id)) {
          map.set(r.customer_id, r.customers);
        }
      });
      setCustomers(Array.from(map.values()));

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
