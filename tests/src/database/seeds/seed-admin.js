/**
 * Bootstrap seed: creates the first admin account (from .env) and the
 * NOVENDIGIT Productivity Dashboard product row, if they don't already
 * exist. Safe to run multiple times.
 *
 * Usage: npm run seed
 */
const pool = require('../pool');
const config = require('../../config');
const authService = require('../../services/authService');

async function seedAdmin() {
  if (!config.adminEmail || !config.adminBootstrapPassword) {
    console.warn('[seed] ADMIN_EMAIL / ADMIN_BOOTSTRAP_PASSWORD not set — skipping admin creation.');
    return;
  }
  const existing = await authService.findUserByEmail(config.adminEmail);
  if (existing) {
    console.log(`[seed] Admin already exists: ${config.adminEmail}`);
    return;
  }
  const user = await authService.createUser({
    email: config.adminEmail,
    password: config.adminBootstrapPassword,
    role: 'admin',
  });
  console.log(`[seed] Created admin account: ${user.email}`);
  console.log('[seed] IMPORTANT: log in and change this password as soon as possible.');
}

async function seedDashboardProduct() {
  const { rows } = await pool.query('SELECT id FROM products WHERE slug = $1', ['productivity-dashboard']);
  if (rows[0]) {
    console.log('[seed] Product "productivity-dashboard" already exists.');
    return;
  }
  await pool.query(
    `INSERT INTO products (slug, name, short_description, price_cents, currency, version, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)`,
    [
      'productivity-dashboard',
      'NOVENDIGIT Productivity Dashboard',
      'A calm, all-in-one dashboard for tasks, habits, goals, and focus.',
      0, // placeholder price — set the real price from the admin dashboard in a later stage
      'USD',
      '1.0',
    ]
  );
  console.log('[seed] Created product: NOVENDIGIT Productivity Dashboard (price is a $0 placeholder — set it later).');
}

async function main() {
  try {
    await seedAdmin();
    await seedDashboardProduct();
  } catch (err) {
    console.error('[seed] Failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
