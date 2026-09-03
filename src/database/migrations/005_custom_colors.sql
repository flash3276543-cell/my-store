-- ============================================================
-- Ensures settings table exists safely before alter
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id BOOLEAN PRIMARY KEY DEFAULT true,
    contact_email VARCHAR(255) DEFAULT '',
    contact_instagram VARCHAR(255) DEFAULT '',
    CONSTRAINT settings_single_row CHECK (id = true)
);

INSERT INTO settings (id, contact_email, contact_instagram)
VALUES (true, '', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Adds full custom-color support to settings, additively.
-- Does NOT touch the existing `theme` column or any other table.
-- Default value = the storefront's current Black & Gold palette,
-- so existing behavior is visually unchanged until an admin
-- explicitly picks different colors.
-- ============================================================

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS custom_colors JSONB NOT NULL DEFAULT '{
    "bg": "#0a0a0a",
    "surface": "#141414",
    "border": "#c5a059",
    "accent": "#c5a059",
    "text": "#ffffff",
    "mutedText": "#a9a6a0"
  }'::jsonb;
