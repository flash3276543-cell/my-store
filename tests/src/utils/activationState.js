/**
 * Signed "activation state" token.
 *
 * WHY THIS EXISTS (see PART 8 — offline behavior):
 * The dashboard must not require a network round-trip on every launch.
 * After a successful /verify or /activate call, the backend issues a
 * short signed token that the frontend caches in localStorage. On
 * later launches, the frontend can trust this token (because it's
 * signed by the server, not something the browser could forge) until
 * it expires, at which point it must reverify with the server.
 *
 * This is an HMAC-signed, base64url-encoded JSON payload — deliberately
 * NOT a full JWT library dependency, since the format is simple and
 * fully internal to this one use case.
 *
 * SECURITY LIMITATION (be explicit with the customer/admin about this):
 * This proves "the server said this license/installation pair was
 * valid as of `issuedAt`" — it does NOT re-prove validity at the
 * moment the app opens offline. A revoked license will still open
 * successfully in the browser until the token expires and a fresh
 * /verify call is forced. Keep REVERIFY_INTERVAL reasonably short
 * (default: 72 hours) to bound this window.
 */
const crypto = require('crypto');
const config = require('../config');

const REVERIFY_INTERVAL_MS = 72 * 60 * 60 * 1000; // 72 hours

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadObj) {
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = crypto
    .createHmac('sha256', config.licenseStateSecret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', config.licenseStateSecret)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig || '', 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Issues a signed activation-state token for a given license +
 * installation pair. `expiresInMs` defaults to the standard
 * reverification interval.
 */
function issueActivationToken({ licenseId, productId, installationId, status }, expiresInMs = REVERIFY_INTERVAL_MS) {
  const now = Date.now();
  return sign({
    licenseId,
    productId,
    installationId,
    status,
    issuedAt: now,
    expiresAt: now + expiresInMs,
  });
}

/**
 * Verifies signature AND expiry. Returns the payload if still valid,
 * or null if the signature is bad or the token has expired (either
 * case means the frontend must call /verify again).
 */
function readActivationToken(token) {
  const payload = verify(token);
  if (!payload) return null;
  if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) return null;
  return payload;
}

module.exports = {
  REVERIFY_INTERVAL_MS,
  issueActivationToken,
  readActivationToken,
};
