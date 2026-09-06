-- ============================================================
-- Adds the storefront's CCP / postal transfer account details to the
-- existing `settings` table (single row), additively. No new table —
-- this is display data shown to the customer, exactly like
-- contact_email/contact_instagram already are.
-- ============================================================

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS ccp_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS ccp_number TEXT;
