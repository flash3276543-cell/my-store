const pool = require('../database/pool');
const { generateLicenseKey, hashKey, isValidKeyFormat } = require('../utils/licenseKey');
const { issueActivationToken } = require('../utils/activationState');

class LicenseError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Generates and stores a brand-new license.
 * Returns the PLAINTEXT key exactly once — callers must show/email it
 * to the customer immediately, because it cannot be recovered later
 * (only its hash is stored).
 *
 * IMPORTANT: per PART 17, this must only be called after payment is
 * confirmed (or by an admin manually). It intentionally does not
 * check payment status itself — that decision belongs to the caller
 * (order service / admin controller), so this function stays reusable.
 */
async function createLicense({ productId, orderId = null, userId = null, customerEmail }) {
  if (!productId || !customerEmail) {
    throw new LicenseError('INVALID_INPUT', 'productId and customerEmail are required.');
  }

  // Retry a handful of times in the astronomically unlikely event of a
  // hash collision on the unique columns.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const plaintextKey = generateLicenseKey();
    const hash = hashKey(plaintextKey);

    try {
      const { rows } = await pool.query(
        `INSERT INTO licenses
           (product_id, order_id, user_id, customer_email, license_key_hash, license_key_lookup, status)
         VALUES ($1, $2, $3, $4, $5, $5, 'UNACTIVATED')
         RETURNING id, product_id, order_id, status, created_at`,
        [productId, orderId, userId, customerEmail, hash]
      );
      return { license: rows[0], plaintextKey };
    } catch (err) {
      if (err.code === '23505') continue; // unique_violation — retry with a new key
      throw err;
    }
  }
  throw new LicenseError('GENERATION_FAILED', 'Could not generate a unique license key. Please try again.', 500);
}

async function findLicenseByPlaintextKey(plaintextKey) {
  const hash = hashKey(plaintextKey);
  const { rows } = await pool.query(
    `SELECT l.*, p.name AS product_name, p.slug AS product_slug
     FROM licenses l JOIN products p ON p.id = l.product_id
     WHERE l.license_key_lookup = $1`,
    [hash]
  );
  return rows[0] || null;
}

async function logActivationEvent(licenseId, { installationId, event, ipAddress, userAgent }) {
  await pool.query(
    `INSERT INTO license_activations (license_id, installation_id, event, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [licenseId, installationId || null, event, ipAddress || null, userAgent || null]
  );
}

/**
 * Activation flow (PART 3 + PART 4):
 *   1. Key must exist.
 *   2. Key must belong to the requested product.
 *   3. Status must not be REVOKED.
 *   4. If UNACTIVATED -> bind to this installationId, become ACTIVE.
 *   5. If ACTIVE and installationId matches -> treat as success (idempotent
 *      re-activation, e.g. customer reloads the activation screen).
 *   6. If ACTIVE and installationId differs -> reject: already activated
 *      elsewhere. Admin must reset it.
 */
async function activateLicense({ plaintextKey, productSlug, installationId, ipAddress, userAgent }) {
  if (!isValidKeyFormat(plaintextKey)) {
    throw new LicenseError('INVALID_FORMAT', 'That does not look like a valid license key.');
  }
  if (!installationId) {
    throw new LicenseError('MISSING_INSTALLATION_ID', 'Missing installation identifier.');
  }

  const license = await findLicenseByPlaintextKey(plaintextKey);
  if (!license) {
    throw new LicenseError('NOT_FOUND', 'Invalid or inactive license key.', 404);
  }

  if (productSlug && license.product_slug !== productSlug) {
    await logActivationEvent(license.id, { installationId, event: 'ACTIVATE_REJECTED', ipAddress, userAgent });
    throw new LicenseError('WRONG_PRODUCT', 'This license does not belong to this product.', 403);
  }

  if (license.status === 'REVOKED') {
    await logActivationEvent(license.id, { installationId, event: 'ACTIVATE_REJECTED', ipAddress, userAgent });
    throw new LicenseError('REVOKED', 'This license has been revoked.', 403);
  }

  if (license.status === 'ACTIVE') {
    if (license.installation_id === installationId) {
      // Idempotent: same device re-activating (e.g. cache cleared but
      // installation id itself preserved) — treat as a normal success.
      await logActivationEvent(license.id, { installationId, event: 'ACTIVATE_SUCCESS', ipAddress, userAgent });
      return buildActivationResult(license);
    }
    await logActivationEvent(license.id, { installationId, event: 'ACTIVATE_REJECTED', ipAddress, userAgent });
    throw new LicenseError(
      'ALREADY_ACTIVATED',
      'This license is already activated on another device.',
      409
    );
  }

  // status === 'UNACTIVATED' -> bind it now
  const { rows } = await pool.query(
    `UPDATE licenses
     SET status = 'ACTIVE', installation_id = $2, activated_at = now(), last_verified_at = now()
     WHERE id = $1
     RETURNING *`,
    [license.id, installationId]
  );
  const updated = { ...rows[0], product_name: license.product_name, product_slug: license.product_slug };
  await logActivationEvent(license.id, { installationId, event: 'ACTIVATE_SUCCESS', ipAddress, userAgent });
  return buildActivationResult(updated);
}

/**
 * Verify flow — used both right after activation and periodically
 * afterward (PART 8 reverification). Does NOT change activation
 * binding; it only checks current status and, if the installation
 * matches, refreshes last_verified_at and issues a fresh signed
 * offline token.
 */
async function verifyLicense({ plaintextKey, productSlug, installationId, ipAddress, userAgent }) {
  if (!isValidKeyFormat(plaintextKey)) {
    throw new LicenseError('INVALID_FORMAT', 'That does not look like a valid license key.');
  }

  const license = await findLicenseByPlaintextKey(plaintextKey);
  if (!license) {
    throw new LicenseError('NOT_FOUND', 'Invalid or inactive license key.', 404);
  }
  if (productSlug && license.product_slug !== productSlug) {
    throw new LicenseError('WRONG_PRODUCT', 'This license does not belong to this product.', 403);
  }
  if (license.status === 'REVOKED') {
    throw new LicenseError('REVOKED', 'This license has been revoked.', 403);
  }
  if (license.status === 'UNACTIVATED') {
    throw new LicenseError('NOT_ACTIVATED', 'This license has not been activated yet.', 403);
  }
  if (license.installation_id !== installationId) {
    throw new LicenseError(
      'INSTALLATION_MISMATCH',
      'This license is registered to a different device.',
      409
    );
  }

  await pool.query('UPDATE licenses SET last_verified_at = now() WHERE id = $1', [license.id]);
  await logActivationEvent(license.id, { installationId, event: 'VERIFY', ipAddress, userAgent });

  return buildActivationResult({ ...license, status: license.status });
}

function buildActivationResult(license) {
  const token = issueActivationToken({
    licenseId: license.id,
    productId: license.product_id,
    installationId: license.installation_id,
    status: license.status,
  });
  return {
    licenseId: license.id,
    status: license.status,
    productSlug: license.product_slug,
    productName: license.product_name,
    activatedAt: license.activated_at,
    activationToken: token,
  };
}

/** Read-only status lookup — no key required, used by customer account pages via a customer's own license id. */
async function getLicenseStatus(licenseId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.status, l.installation_id, l.activated_at, l.last_verified_at, l.revoked_at,
            p.name AS product_name, p.slug AS product_slug
     FROM licenses l JOIN products p ON p.id = l.product_id
     WHERE l.id = $1`,
    [licenseId]
  );
  return rows[0] || null;
}

/** Admin: reset an ACTIVE license back to UNACTIVATED so it can be bound to a new installation. */
async function resetActivation(licenseId, adminUserId) {
  const { rows } = await pool.query(
    `UPDATE licenses
     SET status = 'UNACTIVATED', installation_id = NULL, activated_at = NULL
     WHERE id = $1 AND status != 'REVOKED'
     RETURNING *`,
    [licenseId]
  );
  if (!rows[0]) {
    throw new LicenseError('NOT_FOUND_OR_REVOKED', 'License not found or is revoked (revoked licenses cannot be reset).', 404);
  }
  await logActivationEvent(licenseId, { installationId: null, event: 'RESET', ipAddress: null, userAgent: `admin:${adminUserId}` });
  return rows[0];
}

/** Admin: revoke a license permanently (can be reversed via reactivate). */
async function revokeLicense(licenseId, adminUserId) {
  const { rows } = await pool.query(
    `UPDATE licenses SET status = 'REVOKED', revoked_at = now() WHERE id = $1 RETURNING *`,
    [licenseId]
  );
  if (!rows[0]) throw new LicenseError('NOT_FOUND', 'License not found.', 404);
  await logActivationEvent(licenseId, { installationId: null, event: 'REVOKE', ipAddress: null, userAgent: `admin:${adminUserId}` });
  return rows[0];
}

/** Admin: reactivate a previously revoked license, returning it to UNACTIVATED so the customer must re-activate. */
async function reactivateLicense(licenseId, adminUserId) {
  const { rows } = await pool.query(
    `UPDATE licenses
     SET status = 'UNACTIVATED', revoked_at = NULL, installation_id = NULL, activated_at = NULL
     WHERE id = $1 AND status = 'REVOKED'
     RETURNING *`,
    [licenseId]
  );
  if (!rows[0]) throw new LicenseError('NOT_REVOKED', 'License is not currently revoked.', 404);
  await logActivationEvent(licenseId, { installationId: null, event: 'REACTIVATE', ipAddress: null, userAgent: `admin:${adminUserId}` });
  return rows[0];
}

module.exports = {
  LicenseError,
  createLicense,
  findLicenseByPlaintextKey,
  activateLicense,
  verifyLicense,
  getLicenseStatus,
  resetActivation,
  revokeLicense,
  reactivateLicense,
};
