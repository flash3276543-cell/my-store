-- ============================================================
-- Adds a reversibly-ENCRYPTED copy of the license key, so a customer
-- can view their own key again from "My Account" without needing to
-- contact support. This is separate from license_key_hash /
-- license_key_lookup (used for fast, one-way activation lookups) —
-- those stay exactly as they are.
--
-- Only newly-created licenses (after this migration + the matching
-- backend deploy) will have this column populated; existing licenses
-- created before today were never stored in a recoverable form and
-- will show as unavailable until the admin re-issues them.
-- ============================================================

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_key_encrypted TEXT;
