const crypto = require('crypto');

// AES-256-GCM, not AES-256-CBC: GCM is "authenticated" encryption — it
// detects if the encrypted value was corrupted or tampered with (via the
// authTag check in decryptLicenseKey below). Plain CBC has no such check
// and is vulnerable to padding-oracle style attacks unless paired with a
// separate HMAC, which is extra code for a weaker result. GCM is the
// modern default for exactly this "encrypt a secret, decrypt it later"
// use case, and is still AES-256 as requested.
const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a 32-byte AES-256 key from process.env.ENCRYPTION_KEY (any
 * length/format in — sha256 always gives exactly 32 bytes out, which is
 * what aes-256-* requires). Keeping this separate from the JWT secrets
 * means rotating one doesn't affect the other.
 */
function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY is not set — cannot encrypt/decrypt license keys.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext license key for storage. Returns a single
 * base64 string: iv (12 bytes) + authTag (16 bytes) + ciphertext.
 */
function encryptLicenseKey(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Reverses encryptLicenseKey(). Returns null instead of throwing if the
 * value can't be decrypted (e.g. it predates encryption, or the secret
 * was rotated) — callers should treat null as "key unavailable", not crash.
 */
function decryptLicenseKey(encoded) {
  if (!encoded) return null;
  try {
    const raw = Buffer.from(encoded, 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    return null;
  }
}

module.exports = { encryptLicenseKey, decryptLicenseKey };
