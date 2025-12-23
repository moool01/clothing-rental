# Database Setup Instructions

This repository uses Supabase (PostgreSQL) as its backend. Follow these steps to set up the database schema for a fresh project.

## Prerequisites

1.  A Supabase project created at [supabase.com](https://supabase.com).
2.  Access to the Supabase **SQL Editor**.

## Steps

1.  **Open the SQL Editor**:
    *   Navigate to your project in the Supabase Dashboard.
    *   Click on the **SQL Editor** icon in the left sidebar.

2.  **Run `schema.sql`**:
    *   Copy the entire content of the `schema.sql` file from this repository.
    *   Paste it into a new SQL query window in Supabase.
    *   Click **Run**.
    *   *Note:* Ensure the run completes successfully (check for "Success" message).

3.  **Verify Setup**:
    *   Go to the **Table Editor** (grid icon). You should see the following tables:
        *   `customers`
        *   `design_size_inventory`
        *   `rentals`
        *   `purchases`
        *   `shipments`
    *   Check **Database > Functions** to ensure `get_weekly_inventory_stats` exists.

## Notes

*   **Row Level Security (RLS)**: The schema enables RLS on all tables. By default, it includes permissive policies (`Enable all access for authenticated users`) suitable for development. For production, you may need to tighten these policies (e.g., checking `company_id`).
*   **Triggers**: `updated_at` columns are automatically updated via triggers.
*   **Weekly Inventory Logic**: The `get_weekly_inventory_stats` function calculates availability based on a Monday-Sunday week. Any rental (except '취소') overlapping the week consumes inventory.
