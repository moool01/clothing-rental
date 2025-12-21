-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Customers Table
create table public.customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text not null,
  address text,
  memo text,
  company_id text,
  deposit_account text,
  emergency_contact text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Design Size Inventory Table
create table public.design_size_inventory (
  id uuid default gen_random_uuid() primary key,
  design_code text not null,
  design_name text not null,
  size text not null,
  category text,
  season text,
  brand text,
  color text,
  rental_price integer default 0,
  purchase_price integer default 0,
  total_quantity integer default 0,
  rented_quantity integer default 0,
  available_quantity integer default 0,
  sold_quantity integer default 0,
  available_for_sale integer default 0,
  outstanding_shipment integer default 0,
  shippable integer default 0,
  order_required integer default 0,
  condition text,
  inventory_type text not null,
  display_order integer,
  company_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Rentals Table
create table public.rentals (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id),
  design_code text not null,
  design_name text not null,
  size text not null,
  quantity integer default 1,
  rental_date timestamp with time zone not null,
  return_due_date timestamp with time zone not null,
  return_date timestamp with time zone,
  rental_price integer default 0,
  status text not null,
  delivery_method text,
  notes text,
  company_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Purchases Table
create table public.purchases (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id),
  design_code text not null,
  design_name text not null,
  size text not null,
  quantity integer default 1,
  purchase_date timestamp with time zone not null,
  purchase_price integer default 0,
  status text not null,
  pickup_method text,
  return_method text,
  expected_ship_date timestamp with time zone,
  company_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Shipments Table
create table public.shipments (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id),
  design_code text not null,
  design_name text not null,
  size text not null,
  quantity integer default 1,
  shipment_date timestamp with time zone not null,
  shipping_method text not null,
  status text not null,
  notes text,
  company_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.customers enable row level security;
alter table public.design_size_inventory enable row level security;
alter table public.rentals enable row level security;
alter table public.purchases enable row level security;
alter table public.shipments enable row level security;

-- Create policies (Example: Allow all access for now, can be restricted later)
create policy "Allow all access for customers" on public.customers for all using (true);
create policy "Allow all access for inventory" on public.design_size_inventory for all using (true);
create policy "Allow all access for rentals" on public.rentals for all using (true);
create policy "Allow all access for purchases" on public.purchases for all using (true);
create policy "Allow all access for shipments" on public.shipments for all using (true);

-- Function to handle updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger handle_updated_at_customers
  before update on public.customers
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_inventory
  before update on public.design_size_inventory
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_rentals
  before update on public.rentals
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_purchases
  before update on public.purchases
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_shipments
  before update on public.shipments
  for each row execute procedure public.handle_updated_at();
