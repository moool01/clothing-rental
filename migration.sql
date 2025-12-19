-- Migration SQL for existing database
-- Usage: Run this in the Supabase SQL Editor

-- 1. Add missing columns to Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deposit_account TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS memo TEXT;

-- 2. Add missing columns to Design Size Inventory
ALTER TABLE design_size_inventory ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE design_size_inventory ADD COLUMN IF NOT EXISTS season TEXT;
ALTER TABLE design_size_inventory ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE design_size_inventory ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE design_size_inventory ADD COLUMN IF NOT EXISTS purchase_price INTEGER DEFAULT 0;

-- 3. Add missing columns to Rentals
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_date DATE;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS delivery_method TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Create View for Weekly Availability (Mon-Sun logic)
-- This view calculates the weekly availability for the 'current' week (relative to query time) or logic can be adapted.
-- For a generalized 'check specific week' logic, functions are better, but a View can show 'current week status'.
-- Here is a helper function to calculate weekly availability dynamically.

CREATE OR REPLACE FUNCTION get_weekly_availability(
  target_date DATE
)
RETURNS TABLE (
  design_code TEXT,
  size TEXT,
  total_quantity INTEGER,
  reserved_quantity BIGINT,
  available_quantity INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  week_start DATE;
  week_end DATE;
  -- Convert Sunday(0) to 7 for correct Mon-Sun calculation
  day_offset INTEGER;
BEGIN
  -- Calculate Monday of the week
  day_offset := EXTRACT(DOW FROM target_date);
  IF day_offset = 0 THEN
    day_offset := 7;
  END IF;

  week_start := target_date - (day_offset - 1);
  week_end := week_start + 6;

  RETURN QUERY
  SELECT
    ds.design_code,
    ds.size,
    ds.total_quantity,
    (
      SELECT COUNT(*)
      FROM rentals r
      WHERE r.design_code = ds.design_code
        AND r.size = ds.size
        AND r.status IN ('대여예정', '출고완료', '대여중', '반납완료', '연체')
        -- Overlap Logic: (StartA <= EndB) and (EndA >= StartB)
        AND r.rental_date <= week_end
        AND (COALESCE(r.return_due_date, r.rental_date) >= week_start)
    ) as reserved_quantity,
    (
      ds.total_quantity - (
        SELECT COUNT(*)
        FROM rentals r
        WHERE r.design_code = ds.design_code
          AND r.size = ds.size
          AND r.status IN ('대여예정', '출고완료', '대여중', '반납완료', '연체')
          AND r.rental_date <= week_end
          AND (COALESCE(r.return_due_date, r.rental_date) >= week_start)
      )::INTEGER
    ) as available_quantity
  FROM design_size_inventory ds
  WHERE ds.inventory_type = '대여용';
END;
$$;

-- Example Usage:
-- SELECT * FROM get_weekly_availability('2023-10-25');
