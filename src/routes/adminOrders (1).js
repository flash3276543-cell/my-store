const express = require('express');
const { param } = require('express-validator');
const orderController = require('../controllers/orderController');
const { runValidation } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

/** GET /api/admin/orders — every order (view-only; no status updates in this stage). */
router.get('/', orderController.adminList);

/** POST /api/admin/orders/:id/verify — verify a pending payment (any method); triggers license generation. */
router.post('/:id/verify', [param('id').isUUID().withMessage('Invalid order id.')], runValidation, orderController.adminVerify);

/** POST /api/admin/orders/:id/reject — reject a pending payment (any method). */
router.post('/:id/reject', [param('id').isUUID().withMessage('Invalid order id.')], runValidation, orderController.adminReject);

module.exports = router;
