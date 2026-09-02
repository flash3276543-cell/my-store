const express = require('express');
const { body } = require('express-validator');
const pool = require('../database/pool');
const { runValidation } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');

const ALLOWED_THEMES = ['', 'cyberpunk', 'royal-blue', 'emerald'];

const DEFAULTS = {
  theme: '',
  contactEmail: 'namire345729@gmail.com',
  contactInstagram: 'https://instagram.com/novendigit',
};

function toResponseShape(row) {
  if (!row) return { ...DEFAULTS };
  return {
    theme: row.theme,
    contactEmail: row.contact_email,
    contactInstagram: row.contact_instagram,
  };
}

// --- Public: GET /api/settings ---------------------------------------------
// Read by the storefront on every page load. No auth required — this is
// what makes the theme/contact details consistent across every device
// instead of being stuck in a single browser's localStorage.
const publicRouter = express.Router();

publicRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT theme, contact_email, contact_instagram FROM settings WHERE id = true'
    );
    res.json({ data: toResponseShape(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// --- Admin: PUT /api/admin/settings -----------------------------------------
// Any field left out of the request body is left unchanged (COALESCE),
// so the admin panel can save theme and contact details independently.
const adminRouter = express.Router();

adminRouter.put(
  '/',
  requireAdmin,
  [
    body('theme').optional({ nullable: true }).isIn(ALLOWED_THEMES).withMessage('Invalid theme.'),
    body('contactEmail').optional({ nullable: true }).isEmail().withMessage('Valid contactEmail is required.'),
    body('contactInstagram').optional({ nullable: true }).isURL().withMessage('Valid contactInstagram URL is required.'),
  ],
  runValidation,
  async (req, res, next) => {
    try {
      const { theme, contactEmail, contactInstagram } = req.body;
      const { rows } = await pool.query(
        `UPDATE settings
         SET theme = COALESCE($1, theme),
             contact_email = COALESCE($2, contact_email),
             contact_instagram = COALESCE($3, contact_instagram)
         WHERE id = true
         RETURNING theme, contact_email, contact_instagram`,
        [theme ?? null, contactEmail ?? null, contactInstagram ?? null]
      );
      res.json({ data: toResponseShape(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = { publicRouter, adminRouter };
