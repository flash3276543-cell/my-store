-- Reverses 002_settings.sql.
DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
DROP TABLE IF EXISTS settings CASCADE;
