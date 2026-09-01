const express = require('express');
const { body, param } = require('express-validator');
const licenseController = require('../controllers/licenseController');
const { runValidation } = require('../middleware/validate');
const { licenseLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth'); // استيراد التحقق من تسجيل الدخول

const router = express.Router();

// جلب مفاتيح الزبون المسجل دخول حالياً
router.get('/mine', requireAuth, licenseController.getMyLicenses);

router.post(
  '/activate',
  licenseLimiter,
  [
    body('licenseKey').isString().trim().notEmpty().withMessage('licenseKey is required.'),
    body('productSlug').isString().trim().notEmpty().withMessage('productSlug is required.'),
    body('installationId').isString().trim().isLength({ min: 8, max: 200 }).withMessage('Valid installationId is required.'),
  ],
  runValidation,
  licenseController.activate
);

router.post(
  '/verify',
  licenseLimiter,
  [
    body('licenseKey').isString().trim().notEmpty().withMessage('licenseKey is required.'),
    body('productSlug').isString().trim().notEmpty().withMessage('productSlug is required.'),
    body('installationId').isString().trim().isLength({ min: 8, max: 200 }).withMessage('Valid installationId is required.'),
  ],
  runValidation,
  licenseController.verify
);

router.get(
  '/:id/status',
  [param('id').isUUID().withMessage('Invalid license id.')],
  runValidation,
  licenseController.status
);

module.exports = router;
