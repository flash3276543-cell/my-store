/**
 * License key generation & hashing.
 *
 * Format: NVD-XXXX-XXXX-XXXX
 *   - "NVD" fixed prefix (brand)
 *   - 3 groups of 4 characters from a restricted alphabet
 *
 * The alphabet excludes visually-confusable characters (0/O, 1/I/L)
 * so keys are easy for customers to read and type correctly.
 *
 * SECURITY NOTE:
 * The plaintext key is generated once, shown to the customer once
 * (order confirmation page / email / account page), and then
 * discarded by the server. Only two derived values are stored:
 *
 *   license_key_hash    — SHA-256(key), used to verify a submitted
 *                          key really matches (constant-time compare)
 *   license_key_lookup  — SHA-256(key) truncated/re-encoded, used as
 *                          an indexed lookup column so we can find the
 *                          row without scanning the whole table.
 *
 * In this implementation lookup and hash are the same SHA-256 digest;
 * they're kept as two named concepts/columns so a future change (e.g.
 * switching the verification hash to a slower KDF like bcrypt/argon2
 * while keeping a fast lookup hash) doesn't require a schema change.
 */
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const PREFIX = 'NVD';
const GROUP_COUNT = 3;
const GROUP_LENGTH = 4;

function randomGroup() {
  let out = '';
  const bytes = crypto.randomBytes(GROUP_LENGTH);
  for (let i = 0; i < GROUP_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Generates a new plaintext license key, e.g. "NVD-7K4P-92XM-A81Q". */
function generateLicenseKey() {
  const groups = [];
  for (let i = 0; i < GROUP_COUNT; i++) groups.push(randomGroup());
  return `${PREFIX}-${groups.join('-')}`;
}

/** Returns true if the string is a syntactically valid NOVENDIGIT key. */
function isValidKeyFormat(key) {
  if (typeof key !== 'string') return false;
  const pattern = new RegExp(
    `^${PREFIX}-[A-Z0-9]{${GROUP_LENGTH}}-[A-Z0-9]{${GROUP_LENGTH}}-[A-Z0-9]{${GROUP_LENGTH}}$`
  );
  return pattern.test(key.trim().toUpperCase());
}

/** Normalizes user input (trim, uppercase) before hashing/comparison. */
function normalizeKey(key) {
  return (key || '').trim().toUpperCase();
}

/** SHA-256 hash of the normalized key, hex-encoded. */
function hashKey(key) {
  return crypto.createHash('sha256').update(normalizeKey(key)).digest('hex');
}

/**
 * Constant-time comparison of two hash strings, to avoid leaking
 * timing information about how much of the hash matched.
 */
function safeCompareHash(a, b) {
  const bufA = Buffer.from(a || '', 'hex');
  const bufB = Buffer.from(b || '', 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generateLicenseKey,
  isValidKeyFormat,
  normalizeKey,
  hashKey,
  safeCompareHash,
};
