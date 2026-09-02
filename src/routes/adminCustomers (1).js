const express = require('express');
const pool = require('../database/pool');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

/**
 * GET /api/admin/customers
 * Used by the admin panel's "select a customer" dropdown when manually
 * assigning a license. Password hashes are never selected.
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, created_at FROM users WHERE role = 'customer' ORDER BY created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
