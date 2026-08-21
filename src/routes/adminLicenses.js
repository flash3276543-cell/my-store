const express = require('express');
const { body, param } = require('express-validator');
const licenseController = require('../controllers/licenseController');
const { runValidation } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.post(
  '/',
  [
    body('productId').isUUID().withMessage('Valid productId is required.'),
    body('customerEmail').isEmail().withMessage('Valid customerEmail is required.'),
    body('userId').optional().isUUID().withMessage('Invalid userId.'),
    body('orderId').optional({ nullable: true }).isUUID(),
  ],
  runValidation,
  licenseController.adminCreate
);

router.post(
  '/:id/reset',
  [param('id').isUUID()],
  runValidation,
  licenseController.adminReset
);

router.post(
  '/:id/revoke',
  [param('id').isUUID()],
  runValidation,
  licenseController.adminRevoke
);

router.post(
  '/:id/reactivate',
  [param('id').isUUID()],
  runValidation,
  licenseController.adminReactivate
);

module.exports = router;
