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
