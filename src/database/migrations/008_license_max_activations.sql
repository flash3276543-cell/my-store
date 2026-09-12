-- ============================================================
-- Adds `max_activations` to the existing licenses table as metadata
-- only. Default = 1, matching the current, unchanged behavior of the
-- installationId activation system (exactly one device per license).
--
-- IMPORTANT: this migration does NOT change any activation/verification
-- logic (licenseService.activateLicense / verifyLicense are untouched).
-- It exists so a license's intended activation limit is visible/
-- queryable, in preparation for potential future multi-seat support —
-- enforcing anything beyond 1 is explicitly out of scope for this stage.
-- ============================================================

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS max_activations INTEGER NOT NULL DEFAULT 1;
