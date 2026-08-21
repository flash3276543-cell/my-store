const express = require('express');
const { body, param } = require('express-validator');
const licenseController = require('../controllers/licenseController');
const { runValidation } = require('../middleware/validate');
const { licenseLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

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

router.get('/mine', requireAuth, licenseController.listMine);

router.get(
  '/:id/status',
  requireAuth,
  [param('id').isUUID().withMessage('Invalid license id.')],
  runValidation,
  licenseController.status
);

module.exports = router;
