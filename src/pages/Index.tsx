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
            <TabsTrigger value="weekly-calendar">주간달력</TabsTrigger>
            <TabsTrigger value="rental-inventory">대여용재고</TabsTrigger>
            <TabsTrigger value="rentals">대여관리</TabsTrigger>
            <TabsTrigger value="purchase-inventory">구매용 재고</TabsTrigger>
            <TabsTrigger value="shipments">출고관리</TabsTrigger>
            <TabsTrigger value="purchases">구매관리</TabsTrigger>
            <TabsTrigger value="customers">고객관리</TabsTrigger>
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
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default function Index() {
  return <Dashboard />;
}
