-- Customers Table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    company_id UUID,
    deposit_account TEXT, -- Added: 보증금 환급 계좌
    emergency_contact TEXT, -- Added: 비상 연락처
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Design Size Inventory Table
CREATE TABLE design_size_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_code TEXT NOT NULL,
    design_name TEXT NOT NULL,
    size TEXT NOT NULL,
    rental_price INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    rented_quantity INTEGER DEFAULT 0,
    sold_quantity INTEGER DEFAULT 0,
    available_for_sale INTEGER DEFAULT 0,
    outstanding_shipment INTEGER DEFAULT 0,
    shippable INTEGER DEFAULT 0,
    order_required INTEGER DEFAULT 0,
    condition TEXT,
    inventory_type TEXT DEFAULT '대여용', -- '대여용' | '구매용'
    display_order INTEGER,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rentals Table
CREATE TABLE rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    design_code TEXT NOT NULL,
    design_name TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    rental_date DATE NOT NULL,
    return_due_date DATE,
    rental_price INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- '대여예정', '출고완료', '대여중', '반납완료', '연체'
    delivery_method TEXT, -- Added: 배송방법 (sorting requirement)
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases Table
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    design_code TEXT NOT NULL,
    design_name TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    purchase_date DATE NOT NULL,
    purchase_price INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- '구매완료', '취소'
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipments Table
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    design_code TEXT NOT NULL,
    design_name TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    shipment_date DATE NOT NULL,
    shipping_method TEXT NOT NULL, -- '택배', '등기', '직접수령'
    status TEXT NOT NULL, -- '출고대기', '출고완료', '배송중', '배송완료'
    notes TEXT,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    -- tracking_number removed
);
