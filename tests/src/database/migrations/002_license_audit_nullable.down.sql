-- Restores the original constraint only when no audit rows contain NULL
-- installation_id. Reverting can fail safely if admin lifecycle events exist.
ALTER TABLE license_activations
  ALTER COLUMN installation_id SET NOT NULL;
