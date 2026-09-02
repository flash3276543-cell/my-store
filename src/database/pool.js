const { Pool } = require('pg');
const config = require('../config');

// Render (and most managed Postgres hosts) require SSL for connections
// from the app, but present a certificate that Node's default strict
// validation rejects. Without this, every single query fails — which
// looks like a generic 500 on every DB-touching route (register, login,
// /me, products, licenses...). Skip only for a genuinely local Postgres.
const useSSL = config.nodeEnv === 'production' || /render\.com/i.test(config.databaseUrl || '');

const pool = new Pool({
  connectionString: config.databaseUrl,
  // Keep the pool small by default — appropriate for a single small
  // Express instance. Raise max if you outgrow this.
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Unexpected errors on idle clients — log, don't crash the process.
  // eslint-disable-next-line no-console
  console.error('[db] Unexpected error on idle client', err);
});

module.exports = pool;
