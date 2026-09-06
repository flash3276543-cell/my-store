const express = require('express');
const { body, param } = require('express-validator');
const orderController = require('../controllers/orderController');
const { runValidation } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** POST /api/orders — logged-in customer only. */
router.post(
  '/',
  requireAuth,
  [
    body('productId').isUUID().withMessage('Valid productId is required.'),
    body('paymentMethod').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  ],
  runValidation,
  orderController.create
);

/** GET /api/orders/mine — the logged-in customer's own orders. */
router.get('/mine', requireAuth, orderController.mine);

/** POST /api/orders/:id/payment-proof — customer's "I HAVE PAID" for a CCP order. */
router.post(
  '/:id/payment-proof',
  requireAuth,
  [
    param('id').isUUID().withMessage('Invalid order id.'),
    body('providerRef').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
    body('paymentDate').optional({ nullable: true }).isISO8601().withMessage('paymentDate must be a valid date.'),
    body('note').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  ],
  runValidation,
  orderController.submitProof
);

module.exports = router;
