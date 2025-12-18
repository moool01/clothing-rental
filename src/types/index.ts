export interface Customer {
  id: string;
  name: string;
  phone: string;
  // email removed as per requirements
  address?: string | null;
  company_id?: string | null;
  deposit_account?: string | null; // Added: 보증금 환급 계좌
  emergency_contact?: string | null; // Added: 비상 연락처
}

export interface DesignSizeInventory {
  id: string;
  design_code: string;
  design_name: string;
  size: string;
  rental_price: number;
  total_quantity: number;
  rented_quantity: number;
  available_quantity: number;

  // Purchase extensions
  sold_quantity?: number | null;
  // shipped_quantity removed/hidden as per requirements
  available_for_sale?: number | null;
  outstanding_shipment?: number | null;
  shippable?: number | null;
  order_required?: number | null;

  condition?: string | null;
  inventory_type: string; // '대여용' | '구매용'
  display_order?: number | null;
  company_id?: string | null;

  // Computed fields for weekly view
  weekRentals?: number;
  weekReturned?: number;
  finalAvailable?: number;
  weekly_rented_quantity?: number;
  weekly_available_quantity?: number;
}

export interface Rental {
  id: string;
  customer_id: string;
  design_code: string;
  design_name: string;
  size: string;
  quantity: number;
  rental_date: string;
  return_due_date: string;
  rental_price: number;
  status: string; // '대여예정', '출고완료', '대여중', '반납완료', '연체'
  delivery_method?: string | null; // Added for sorting requirement
  customers?: Customer | null;
  created_at?: string;
}

export interface Purchase {
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
  created_at?: string;
}

export interface Shipment {
  id: string;
  customer_id: string;
  design_code: string;
  design_name: string;
  size: string;
  quantity: number;
  shipment_date: string;
  // tracking_number removed/hidden
  shipping_method: string;
  status: string;
  notes?: string | null;
  customers?: Customer | null;
  created_at?: string;
}

export type WeekRange = { start: Date; end: Date };
