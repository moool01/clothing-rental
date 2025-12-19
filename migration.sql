-- Rename delivery_method to shipping_method in rentals
ALTER TABLE rentals RENAME COLUMN delivery_method TO shipping_method;

-- Add shipping_method to purchases if it doesn't exist (optional, but good for consistency if we track it at purchase time)
-- ALTER TABLE purchases ADD COLUMN IF NOT EXISTS shipping_method TEXT;
