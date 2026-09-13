-- ============================================================
-- Adds a DOWNLOAD_SUCCESS event value to the existing
-- license_activations audit table, so authenticated product
-- downloads leave an audit trail alongside activation events.
-- No existing event value is removed; this only widens the CHECK.
-- Finds the constraint by inspecting pg_constraint instead of
-- assuming its auto-generated name, so it works regardless of how
-- Postgres named it originally.
-- ============================================================

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT conname INTO existing_constraint
  FROM pg_constraint
  WHERE conrelid = 'license_activations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%event%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE license_activations DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE license_activations
  ADD CONSTRAINT license_activations_event_check
  CHECK (event IN (
    'ACTIVATE_SUCCESS', 'ACTIVATE_REJECTED', 'VERIFY', 'RESET', 'REVOKE', 'REACTIVATE',
    'DOWNLOAD_SUCCESS'
  ));
