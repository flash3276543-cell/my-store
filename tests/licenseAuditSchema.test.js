const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const migrationPath = path.join(__dirname, '../src/database/migrations/001_init.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

test('license_activations schema allows admin lifecycle events without an installation id', () => {
  const tableDef = migrationSql.match(/CREATE TABLE IF NOT EXISTS license_activations \([\s\S]*?\);/);

  assert.ok(tableDef, 'license_activations table definition should exist in the migration');
  assert.match(tableDef[0], /installation_id\s+TEXT\b/);
  assert.doesNotMatch(tableDef[0], /installation_id\s+TEXT\s+NOT NULL/);
  assert.match(
    tableDef[0],
    /event\s+TEXT NOT NULL CHECK \(event IN \('ACTIVATE_SUCCESS','ACTIVATE_REJECTED','VERIFY','RESET','REVOKE','REACTIVATE'\)\)/
  );
});
