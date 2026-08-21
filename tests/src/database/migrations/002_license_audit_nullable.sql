-- Allows admin RESET, REVOKE, and REACTIVATE audit events to omit installation_id.
-- Migration 001 is already applied in existing environments; do not edit it to
-- update an existing database.
ALTER TABLE license_activations
  ALTER COLUMN installation_id DROP NOT NULL;
