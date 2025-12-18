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
    monday.setHours(0, 0, 0, 0); // Normalize start time

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999); // Normalize end time

    return { start: monday, end: sunday };
  };

  const calculateWeeklyInventory = useCallback((startDate: Date, endDate: Date, inventory: DesignSizeInventory[], rentalsData: Rental[]) => {
    // Ensure start/end dates are normalized for comparison if not already
    const sDate = new Date(startDate);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(endDate);
    eDate.setHours(23, 59, 59, 999);

    const weeklyData = inventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const totalAvailable = item.total_quantity;

        // 화~일 대여중 합계 logic:
        // Logic from original code:
        // const tuesday = new Date(startDate); tuesday.setDate(startDate.getDate() + 1);
        // But let's stick to the overlap logic provided in the user's snippet which is more standard:
        // "rentalStart <= weekEnd && rentalEnd >= weekStart"
        // Wait, the user's snippet used that logic. The original code used a specific "Tue-Sun" + "Mon return" logic.
        // User asked to fix "Sold Out List". The snippet uses overlap logic.
        // I will adapt the overlap logic from the snippet but refine it for "Tue-Sun" business rule if that's what "Sold Out" implies?
        // Actually, the "Sold Out" list just means `finalAvailable === 0`.
        // Let's use the robust overlap logic.

        // However, the original code had a specific business rule:
        // "Every week resets (Tue-Sun rental, Mon return)".
        // If I change the logic entirely, I might break that rule.
        // But the user pasted code with `rentalStart <= weekEnd && rentalEnd >= weekStart`.
        // I will use the logic from the user's pasted snippet as they seem to prefer that logic for the calculation.

        const weekRentalsQty = rentalsData
          .filter(r => {
            if (r.design_code !== item.design_code || r.size !== item.size) return false;
            if (r.status !== '대여중') return false;

            const rentalStart = new Date(r.rental_date);
            rentalStart.setHours(0, 0, 0, 0);

            const rentalEnd = r.return_due_date ? new Date(r.return_due_date) : new Date(r.rental_date); // fallback
            rentalEnd.setHours(23, 59, 59, 999);

            // Overlap check
            return rentalStart <= eDate && rentalEnd >= sDate;
          })
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        const finalAvailable = Math.max(0, totalAvailable - weekRentalsQty);

        return {
          ...item,
          weekRentals: weekRentalsQty,
          weekReturned: 0, // Simplified as per new logic
          finalAvailable,
        };
      });

    setAllWeeklyInventory(weeklyData);
    setWeeklyInventorySoldOut(weeklyData.filter(x => x.finalAvailable === 0));
  }, []);

  const calculateWeeklyRentalInventory = useCallback((weekStart: Date, weekEnd: Date, inventory: DesignSizeInventory[], rentalsData: Rental[]) => {
    const sDate = new Date(weekStart);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(weekEnd);
    eDate.setHours(23, 59, 59, 999);

    return inventory
      .filter(item => item.inventory_type === '대여용')
      .map(item => {
        const overlappedQty = rentalsData
          .filter(r => {
            if (r.design_code !== item.design_code || r.size !== item.size) return false;
            if (r.status !== '대여중' && r.status !== '연체') return false;

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
      selected.setHours(0,0,0,0);

      const { start: monday, end: sunday } = getWeekRange(selected);
      // Ensure range covers the week
      monday.setHours(0,0,0,0);
      sunday.setHours(23,59,59,999);

      const weeklyData = designSizeInventory
        .filter(item => item.inventory_type === '대여용')
        .map(item => {
          const weekRentalsQty = rentals
            .filter(r => {
              if (r.design_code !== item.design_code || r.size !== item.size) return false;
              if (r.status !== '대여중') return false;

              const rentalStart = new Date(r.rental_date);
              rentalStart.setHours(0,0,0,0);
              const rentalEnd = r.return_due_date ? new Date(r.return_due_date) : new Date(r.rental_date);
              rentalEnd.setHours(23,59,59,999);

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
