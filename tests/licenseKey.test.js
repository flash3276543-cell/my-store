const test = require('node:test');
const assert = require('node:assert');
const {
  generateLicenseKey,
  isValidKeyFormat,
  normalizeKey,
  hashKey,
  safeCompareHash,
} = require('../src/utils/licenseKey');

test('generateLicenseKey produces the correct format', () => {
  const key = generateLicenseKey();
  assert.match(key, /^NVD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test('generateLicenseKey excludes confusable characters', () => {
  for (let i = 0; i < 200; i++) {
    const key = generateLicenseKey();
    assert.ok(!/[0O1IL]/.test(key.replace(/^NVD-/, '')), `key ${key} contained a confusable character`);
  }
});

test('generateLicenseKey produces unique keys across many calls', () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) seen.add(generateLicenseKey());
  assert.strictEqual(seen.size, 1000);
});

test('isValidKeyFormat accepts well-formed keys', () => {
  assert.ok(isValidKeyFormat('NVD-7K4P-92XM-A81Q'));
  assert.ok(isValidKeyFormat('nvd-7k4p-92xm-a81q')); // case-insensitive
});

test('isValidKeyFormat rejects malformed keys', () => {
  assert.ok(!isValidKeyFormat('NVD-7K4P-92XM'));
  assert.ok(!isValidKeyFormat('XYZ-7K4P-92XM-A81Q'));
  assert.ok(!isValidKeyFormat('NVD-7K4P-92XM-A81Q-EXTRA'));
  assert.ok(!isValidKeyFormat(''));
  assert.ok(!isValidKeyFormat(null));
});

test('hashKey is deterministic and case/whitespace-insensitive', () => {
  const a = hashKey('NVD-7K4P-92XM-A81Q');
  const b = hashKey(' nvd-7k4p-92xm-a81q ');
  assert.strictEqual(a, b);
});

test('hashKey produces different hashes for different keys', () => {
  const a = hashKey('NVD-7K4P-92XM-A81Q');
  const b = hashKey('NVD-7K4P-92XM-A81R');
  assert.notStrictEqual(a, b);
});

test('normalizeKey trims and uppercases', () => {
  assert.strictEqual(normalizeKey('  nvd-abcd-efgh-jklm '), 'NVD-ABCD-EFGH-JKLM');
});

test('safeCompareHash matches equal hashes and rejects different ones', () => {
  const h1 = hashKey('NVD-AAAA-BBBB-CCCC');
  const h2 = hashKey('NVD-AAAA-BBBB-CCCC');
  const h3 = hashKey('NVD-AAAA-BBBB-CCCD');
  assert.ok(safeCompareHash(h1, h2));
  assert.ok(!safeCompareHash(h1, h3));
});
