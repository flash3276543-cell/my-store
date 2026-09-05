-- ============================================================
-- Extends the EXISTING `orders` table (created in 001_init.sql) with
-- the fields needed for manual order tracking, instead of creating a
-- second/competing orders table.
--
-- The original `status` column (PENDING/PAID/FAILED/REFUNDED/CANCELLED)
-- is left untouched and unused by the new code — nothing currently
-- reads or writes it (no order routes existed before this migration),
-- so leaving it in place is simply non-destructive, not a functional
-- change either way.
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (order_status IN ('pending', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
