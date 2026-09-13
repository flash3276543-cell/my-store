-- Reverts to the original event set. Will fail if any DOWNLOAD_SUCCESS
-- rows already exist (delete them first if you truly need to roll back).
ALTER TABLE license_activations DROP CONSTRAINT IF EXISTS license_activations_event_check;

ALTER TABLE license_activations
  ADD CONSTRAINT license_activations_event_check
  CHECK (event IN ('ACTIVATE_SUCCESS','ACTIVATE_REJECTED','VERIFY','RESET','REVOKE','REACTIVATE'));
