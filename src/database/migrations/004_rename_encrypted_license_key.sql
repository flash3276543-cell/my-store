-- ============================================================
-- Normalizes the encrypted-license-key column name to
-- `encrypted_license_key`. Safe to run whether or not migration 003
-- (license_key_encrypted) was already applied: renames it if present,
-- otherwise adds the column fresh. Either way you end up with exactly
-- one column, `encrypted_license_key`, ready to use.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'license_key_encrypted'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'encrypted_license_key'
  ) THEN
    ALTER TABLE licenses RENAME COLUMN license_key_encrypted TO encrypted_license_key;
  ELSE
    ALTER TABLE licenses ADD COLUMN IF NOT EXISTS encrypted_license_key TEXT;
  END IF;
END $$;

-- license_key_hash / license_key_lookup are untouched — they remain the
-- fast, one-way lookup used by license activation/verification.
