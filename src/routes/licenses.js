const express = require('express');
const { body, param } = require('express-validator');
const licenseController = require('../controllers/licenseController');
const { runValidation } = require('../middleware/validate');
const { licenseLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/licenses/mine — must be declared before the generic
 * '/:id/status' route below so it isn't swallowed by it (it isn't, since
 * the path shapes differ, but keeping "mine" first keeps the file
 * readable: customer-facing routes together, then the generic lookup).
 */
router.get('/mine', requireAuth, licenseController.mine);

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
