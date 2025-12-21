-- =============================================================================
-- Database Schema for Clothing Rental System
-- =============================================================================
-- This script sets up the complete database schema for the Clothing Rental application.
-- It includes table definitions, RLS policies, triggers, and helper functions.
-- Run this script in the Supabase SQL Editor to initialize the database.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- Customers Table
create table if not exists public.customers (
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
create table if not exists public.design_size_inventory (
  id uuid default gen_random_uuid() primary key,
  design_code text not null,
  design_name text not null,
  size text not null,

  -- Normalized columns for easier searching (optional but recommended)
  design_code_norm text generated always as (lower(trim(design_code))) stored,
  size_norm text generated always as (lower(trim(size))) stored,

  category text,
  season text,
  brand text,
  color text,

  rental_price integer default 0 not null,
  purchase_price integer default 0 not null,

  total_quantity integer default 0 not null check (total_quantity >= 0),
  rented_quantity integer default 0 not null,
  available_quantity integer default 0 not null,

  sold_quantity integer default 0 not null,
  available_for_sale integer default 0 not null,
  outstanding_shipment integer default 0 not null,
  shippable integer default 0 not null,
  order_required integer default 0 not null,

  condition text,
  inventory_type text default '대여용' not null check (inventory_type in ('대여용', '구매용')),
  display_order integer,
  company_id text,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Rentals Table
create table if not exists public.rentals (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id),
  design_code text not null,
  design_name text not null,
  size text not null,

  design_code_norm text generated always as (lower(trim(design_code))) stored,
  size_norm text generated always as (lower(trim(size))) stored,

  quantity integer default 1 not null check (quantity > 0),

  rental_date timestamp with time zone not null,
  return_due_date timestamp with time zone not null,
  return_date timestamp with time zone,

  rental_price integer default 0 not null,
  status text not null, -- e.g., '대여예정', '출고완료', '대여중', '반납완료', '연체', '취소'
  delivery_method text,
  notes text,

  company_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Purchases Table
create table if not exists public.purchases (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id),
  design_code text not null,
  design_name text not null,
  size text not null,

  design_code_norm text generated always as (lower(trim(design_code))) stored,
  size_norm text generated always as (lower(trim(size))) stored,

  quantity integer default 1 not null check (quantity > 0),

  purchase_date timestamp with time zone not null,
  purchase_price integer default 0 not null,
  status text not null,
  pickup_method text,
  return_method text,
  expected_ship_date timestamp with time zone,

  company_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Shipments Table
create table if not exists public.shipments (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id),
  design_code text not null,
  design_name text not null,
  size text not null,

  design_code_norm text generated always as (lower(trim(design_code))) stored,
  size_norm text generated always as (lower(trim(size))) stored,

  quantity integer default 1 not null check (quantity > 0),
  shipment_date timestamp with time zone not null,
  shipping_method text not null,
  status text not null,
  notes text,

  company_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security (RLS)
-- -----------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.design_size_inventory enable row level security;
alter table public.rentals enable row level security;
alter table public.purchases enable row level security;
alter table public.shipments enable row level security;

-- Permissive policies for authenticated users (as per requirements)
-- In production, these should be tightened to check company_id or user roles.
create policy "Enable all access for authenticated users" on public.customers for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.design_size_inventory for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.rentals for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.purchases for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on public.shipments for all to authenticated using (true) with check (true);

-- Also allow anonymous access if needed for dev (though usually not recommended)
-- Uncomment if needed:
-- create policy "Enable read access for all users" on public.customers for select using (true);

-- -----------------------------------------------------------------------------
-- 3. Triggers for updated_at
-- -----------------------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Dropping triggers if they exist to allow re-running script cleanly
drop trigger if exists handle_updated_at_customers on public.customers;
create trigger handle_updated_at_customers before update on public.customers for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_updated_at_inventory on public.design_size_inventory;
create trigger handle_updated_at_inventory before update on public.design_size_inventory for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_updated_at_rentals on public.rentals;
create trigger handle_updated_at_rentals before update on public.rentals for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_updated_at_purchases on public.purchases;
create trigger handle_updated_at_purchases before update on public.purchases for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_updated_at_shipments on public.shipments;
create trigger handle_updated_at_shipments before update on public.shipments for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RPC Functions (Weekly Inventory Logic)
-- -----------------------------------------------------------------------------

-- Drop existing function if any
drop function if exists get_weekly_inventory_stats(date);

-- Function to calculate weekly reserved/available quantities
-- Logic:
-- 1. Week is defined as Monday 00:00 to Sunday 23:59.
-- 2. Any rental overlapping this period (Start <= WeekEnd AND End >= WeekStart) consumes a slot.
-- 3. Statuses: Exclude '취소' (cancelled). Include all others ('대여예정', '출고완료', '대여중', '반납완료', '연체').
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
      -- Normalize codes to match loosely (using generated columns if available, or lower/trim)
      -- Using explicit normalization here to be safe
      lower(trim(r.design_code)) as norm_design_code,
      lower(trim(r.size)) as norm_size,
      sum(r.quantity) as reserved_qty
    from
      public.rentals r
    where
      -- Exclude only truly inactive rows (e.g. cancelled).
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
