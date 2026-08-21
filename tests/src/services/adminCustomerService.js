const pool = require('../database/pool');

async function listCustomers() {
  const { rows } = await pool.query(
    `SELECT id, email, created_at
     FROM users
     WHERE role = 'customer'
     ORDER BY created_at ASC`
  );
  return rows;
}

module.exports = { listCustomers };