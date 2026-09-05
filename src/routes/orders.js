const express = require('express');
const { body } = require('express-validator');
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

module.exports = router;
