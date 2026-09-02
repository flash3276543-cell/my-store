-- ============================================================
-- NOVENDIGIT — Storefront settings (theme + contact details)
-- ============================================================
-- Single-row table: the whole point is that the theme and contact
-- details live on the server (not in a browser's localStorage) so
-- every visitor — desktop, phone, or tablet — sees the same values.
-- The `id BOOLEAN ... CHECK (id)` trick is a common, dependency-free
-- way to enforce "exactly one row" in Postgres.
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id                 BOOLEAN PRIMARY KEY DEFAULT true,
  theme              TEXT NOT NULL DEFAULT '' CHECK (theme IN ('', 'cyberpunk', 'royal-blue', 'emerald')),
  contact_email      CITEXT NOT NULL DEFAULT 'namire345729@gmail.com',
  contact_instagram  TEXT NOT NULL DEFAULT 'https://instagram.com/novendigit',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id)
);

-- Seed the single row if it doesn't exist yet.
INSERT INTO settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Reuses the set_updated_at() function created in 001_init.sql.
DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
