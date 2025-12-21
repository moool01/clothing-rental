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
-- Note: 'available_quantity' and 'rented_quantity' are included for compatibility with the frontend interface.
-- However, the weekly logic relies on dynamic calculations (see get_weekly_inventory_stats).
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
  rented_quantity integer default 0, -- Snapshot/Legacy field
  available_quantity integer default 0, -- Snapshot/Legacy field

  sold_quantity integer default 0,
  available_for_sale integer default 0,
  outstanding_shipment integer default 0,
  shippable integer default 0,
  order_required integer default 0,

  condition text,
  inventory_type text not null, -- '대여용' | '구매용'
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
  status text not null, -- '대여예정', '출고완료', '대여중', '반납완료', '연체'
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

-- RLS Policies
alter table public.customers enable row level security;
alter table public.design_size_inventory enable row level security;
alter table public.rentals enable row level security;
alter table public.purchases enable row level security;
alter table public.shipments enable row level security;

create policy "Allow all access for customers" on public.customers for all using (true);
create policy "Allow all access for inventory" on public.design_size_inventory for all using (true);
create policy "Allow all access for rentals" on public.rentals for all using (true);
create policy "Allow all access for purchases" on public.purchases for all using (true);
create policy "Allow all access for shipments" on public.shipments for all using (true);

-- Updated_at Trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at_customers before update on public.customers for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at_inventory before update on public.design_size_inventory for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at_rentals before update on public.rentals for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at_purchases before update on public.purchases for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at_shipments before update on public.shipments for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- Weekly Inventory Logic
-- -----------------------------------------------------------------------------

-- Drop existing function if any
drop function if exists get_weekly_inventory_stats(date);

-- Function to calculate weekly reserved/available quantities
create or replace function get_weekly_inventory_stats(start_date date)
returns table (
  id uuid,
  design_code text,
  design_name text,
  size text,
  total_quantity integer,
  weekly_rented_quantity bigint,
  weekly_available_quantity bigint
) as $$
declare
  week_start date;
  week_end date;
begin
  -- Calculate Monday start and Sunday end of the given date's week
  -- Postgres date_trunc('week', ...) returns Monday of the week.
  week_start := date_trunc('week', start_date)::date;
  week_end := week_start + 6; -- Sunday

  return query
  with weekly_rentals as (
    select
      -- Normalize codes to match loosely as per JS logic
      lower(trim(r.design_code)) as norm_design_code,
      lower(trim(r.size)) as norm_size,
      sum(r.quantity) as reserved_qty
    from
      public.rentals r
    where
      -- Exclude only truly inactive rows (e.g. cancelled).
      -- All other statuses (including '반납완료') count as reserved if they overlap the week.
      r.status not in ('취소')
      and
      -- Overlap Check using DATE boundaries:
      -- Rental Start <= Week End AND Rental End >= Week Start
      (r.rental_date::date <= week_end)
      and
      (coalesce(r.return_due_date, r.rental_date)::date >= week_start)
    group by
      lower(trim(r.design_code)),
      lower(trim(r.size))
  )
  select
    i.id,
    i.design_code,
    i.design_name,
    i.size,
    i.total_quantity,
    coalesce(wr.reserved_qty, 0) as weekly_rented_quantity,
    greatest(0, i.total_quantity - coalesce(wr.reserved_qty, 0)) as weekly_available_quantity
  from
    public.design_size_inventory i
  left join
    weekly_rentals wr
    on lower(trim(i.design_code)) = wr.norm_design_code
    and lower(trim(i.size)) = wr.norm_size
  where
    i.inventory_type = '대여용'
  order by
    i.design_code asc, i.display_order asc;
end;
$$ language plpgsql;
