DROP INDEX IF EXISTS idx_orders_customer_email;
DROP INDEX IF EXISTS idx_orders_user;

ALTER TABLE orders
  DROP COLUMN IF EXISTS order_status,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS payment_method;
