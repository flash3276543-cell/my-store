-- ============================================================
-- NOVENDIGIT — Initial schema (Stage 1: licensing foundation)
-- ============================================================
-- This migration creates the core tables needed for the license
-- system. Store/order/payment tables are included now because
-- licenses reference orders and products, but checkout/payment
-- LOGIC is implemented in a later stage — for now orders and
-- payments exist only as a data model.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- for case-insensitive email columns

-- ------------------------------------------------------------
-- users  (customers AND admins — distinguished by role)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,          -- e.g. 'productivity-dashboard'
  name              TEXT NOT NULL,                 -- e.g. 'NOVENDIGIT Productivity Dashboard'
  short_description TEXT,
  description       TEXT,
  price_cents       INTEGER NOT NULL DEFAULT 0,    -- store money as integer cents
  currency          TEXT NOT NULL DEFAULT 'USD',
  version           TEXT NOT NULL DEFAULT '1.0',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  file_path         TEXT,                          -- server-side path to the protected deliverable (not public URL)
  image_url         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_email    CITEXT NOT NULL,   -- kept even if user_id is null (guest checkout)
  status            TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED','CANCELLED')),
  total_cents       INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at           TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- order_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  unit_price_cents  INTEGER NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- payments  (one payment attempt/confirmation per order, provider-agnostic)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,                 -- e.g. 'example_provider'
  provider_ref      TEXT,                          -- provider's transaction/session id
  status            TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','CONFIRMED','FAILED','REFUNDED')),
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  raw_payload       JSONB,                         -- raw webhook payload for audit (no card data ever stored)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- licenses
-- ------------------------------------------------------------
-- The plaintext license key (NVD-XXXX-XXXX-XXXX) is shown to the
-- customer ONCE (order confirmation / email / account page) and is
-- never stored in plaintext in the database — only its hash.
CREATE TABLE IF NOT EXISTS licenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id),
  order_id          UUID REFERENCES orders(id),          -- nullable: admin can generate one manually before an order exists
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_email    CITEXT NOT NULL,
  license_key_hash  TEXT UNIQUE NOT NULL,                -- sha256 hash of the real key, hex-encoded
  license_key_lookup TEXT UNIQUE NOT NULL,                -- deterministic short lookup hash (see licenseService) to find a row without a table scan
  status            TEXT NOT NULL DEFAULT 'UNACTIVATED'
                       CHECK (status IN ('UNACTIVATED','ACTIVE','REVOKED')),
  installation_id   TEXT,                                 -- set on first successful activation
  activated_at      TIMESTAMPTZ,
  last_verified_at  TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_product ON licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_licenses_order ON licenses(order_id);
CREATE INDEX IF NOT EXISTS idx_licenses_customer_email ON licenses(customer_email);

-- ------------------------------------------------------------
-- license_activations  (full history — a license may have many
-- attempts logged even though only one installation is "current")
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS license_activations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id        UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  installation_id   TEXT,
  event             TEXT NOT NULL CHECK (event IN ('ACTIVATE_SUCCESS','ACTIVATE_REJECTED','VERIFY','RESET','REVOKE','REACTIVATE')),
  ip_address        TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activations_license ON license_activations(license_id);

-- ------------------------------------------------------------
-- updated_at auto-touch trigger (small convenience, no magic)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
