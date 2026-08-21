/**
 * Minimal migration runner.
 *
 * This intentionally does NOT use a migration framework — for a project
 * of this size, a small hand-rolled runner is easier to understand and
 * audit than adding another dependency. It tracks which migrations have
 * run in a `schema_migrations` table so re-running `npm run migrate` is
 * always safe (idempotent).
 *
 * Usage:
 *   npm run migrate         -> applies all pending *.sql files in order
 *   npm run migrate:down    -> reverses the LAST applied migration only
 */
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY id ASC');
  return rows.map((r) => r.name);
}

function listUpMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
}

async function up() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = listUpMigrationFiles();
    const pending = files.filter((f) => !applied.includes(f));

    if (pending.length === 0) {
      console.log('[migrate] Nothing to apply. Database is up to date.');
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] Applying ${file} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] Applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    if (applied.length === 0) {
      console.log('[migrate] No migrations have been applied.');
      return;
    }
    const last = applied[applied.length - 1];
    const downFile = last.replace(/\.sql$/, '.down.sql');
    const downPath = path.join(MIGRATIONS_DIR, downFile);
    if (!fs.existsSync(downPath)) {
      throw new Error(`No down migration found for ${last} (expected ${downFile})`);
    }
    const sql = fs.readFileSync(downPath, 'utf8');
    console.log(`[migrate] Reverting ${last} ...`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('DELETE FROM schema_migrations WHERE name = $1', [last]);
      await client.query('COMMIT');
      console.log(`[migrate] Reverted ${last}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

async function main() {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  try {
    if (direction === 'down') {
      await down();
    } else {
      await up();
    }
  } catch (err) {
    console.error('[migrate] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { up, down };
