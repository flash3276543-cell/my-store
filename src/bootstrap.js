const { up } = require('./database/migrate');
const { seedAdmin } = require('./database/seeds/seed-admin');

/**
 * Boot-time database bootstrap.
 *
 * Why this exists: Render's free tier has no Shell, so `npm run migrate`
 * and `npm run seed` can't be run manually against the deployed
 * database. This runs them automatically on server start instead.
 *
 * Safety properties:
 * - Idempotent. migrate.up() tracks applied files in schema_migrations
 *   and skips them; seedAdmin() checks whether the admin already exists
 *   before creating anything. Restarting the server repeatedly is safe.
 * - Never closes the pool. Unlike the CLI entrypoints of those two
 *   scripts, this does NOT call pool.end() — the running server needs
 *   that pool to stay open.
 * - Never crashes the deployment. Any failure is logged loudly and
 *   swallowed, so the server still boots and serves traffic (a failed
 *   migration shouldn't take the whole site offline; you'd rather have
 *   a running server with a visible error in the logs).
 */
async function bootstrapDatabase() {
  try {
    console.log('[bootstrap] Applying pending migrations...');
    await up();
    console.log('[bootstrap] Migrations complete.');
  } catch (err) {
    console.error('[bootstrap] Migration step failed (server will still start):', err.message);
  }

  try {
    console.log('[bootstrap] Checking admin account...');
    await seedAdmin();
    console.log('[bootstrap] Admin check complete.');
  } catch (err) {
    console.error('[bootstrap] Admin seed step failed (server will still start):', err.message);
  }
}

module.exports = { bootstrapDatabase };
