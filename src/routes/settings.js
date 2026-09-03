const express = require('express');
const { body } = require('express-validator');
const pool = require('../database/pool');
const { runValidation } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');

const ALLOWED_THEMES = ['', 'cyberpunk', 'royal-blue', 'emerald'];

// Default palette matches the storefront's built-in Black & Gold :root
// values exactly, so a fresh settings row renders identically to before
// this feature existed.
const DEFAULT_COLORS = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#c5a059',
  accent: '#c5a059',
  text: '#ffffff',
  mutedText: '#a9a6a0',
};

const DEFAULTS = {
  theme: '',
  contactEmail: 'namire345729@gmail.com',
  contactInstagram: 'https://instagram.com/novendigit',
  customColors: DEFAULT_COLORS,
};

function toResponseShape(row) {
  if (!row) return { ...DEFAULTS };
  return {
    theme: row.theme || '',
    contactEmail: row.contact_email,
    contactInstagram: row.contact_instagram,
    // custom_colors is NOT NULL with a DB default, but fall back defensively
    // in case an older row predates the column somehow.
    customColors: row.custom_colors || DEFAULT_COLORS,
  };
}

// --- Public: GET /api/settings ---------------------------------------------
// Read by the storefront (and now the admin panel too) on every page load.
// No auth required — this is what makes colors/contact details consistent
// across every device instead of being stuck in a single browser's
// localStorage.
const publicRouter = express.Router();

publicRouter.get('/', async (req, res, next) => {
  try {
    // تم التعديل بمرونة: جلب الحقول مع إعطاء قيمة افتراضية للـ theme حتى لا يفشل الاستعلام إذا كان العمود غير موجود في الجدول
    const { rows } = await pool.query(
      `SELECT 
        COALESCE(to_jsonb(s)->>'theme', '') AS theme,
        s.contact_email, 
        s.contact_instagram, 
        s.custom_colors 
       FROM settings s WHERE s.id = true`
    );
    res.json({ data: toResponseShape(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// --- Admin: PUT /api/admin/settings -----------------------------------------
// Any field left out of the request body is left unchanged (COALESCE), so
// theme, contact details, and colors can each be saved independently.
// `theme` is kept for backward compatibility even though the frontend no
// longer offers the 4-preset picker — removing it isn't necessary and
// could break anything still relying on it.
const adminRouter = express.Router();

adminRouter.put(
  '/',
  requireAdmin,
  [
    body('theme').optional({ nullable: true }).isIn(ALLOWED_THEMES).withMessage('Invalid theme.'),
    body('contactEmail').optional({ nullable: true }).isEmail().withMessage('Valid contactEmail is required.'),
    body('contactInstagram').optional({ nullable: true }).isURL().withMessage('Valid contactInstagram URL is required.'),
    body('customColors').optional({ nullable: true }).isObject().withMessage('customColors must be an object.'),
    body('customColors.bg').optional().isHexColor().withMessage('bg must be a valid hex color.'),
    body('customColors.surface').optional().isHexColor().withMessage('surface must be a valid hex color.'),
    body('customColors.border').optional().isHexColor().withMessage('border must be a valid hex color.'),
    body('customColors.accent').optional().isHexColor().withMessage('accent must be a valid hex color.'),
    body('customColors.text').optional().isHexColor().withMessage('text must be a valid hex color.'),
    body('customColors.mutedText').optional().isHexColor().withMessage('mutedText must be a valid hex color.'),
  ],
  runValidation,
  async (req, res, next) => {
    try {
      const { theme, contactEmail, contactInstagram, customColors } = req.body;
      
      // التعديل: التحديث يركز على البيانات الأساسية مع منع الخطأ عند التمرير
      const { rows } = await pool.query(
        `UPDATE settings
         SET contact_email = COALESCE($1, contact_email),
             contact_instagram = COALESCE($2, contact_instagram),
             custom_colors = COALESCE($3::jsonb, custom_colors)
         WHERE id = true
         RETURNING COALESCE(to_jsonb(settings)->>'theme', '') AS theme, contact_email, contact_instagram, custom_colors`,
        [contactEmail ?? null, contactInstagram ?? null, customColors ? JSON.stringify(customColors) : null]
      );
      res.json({ data: toResponseShape(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = { publicRouter, adminRouter };
