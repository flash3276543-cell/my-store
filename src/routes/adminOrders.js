const express = require('express');
const orderController = require('../controllers/orderController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

/** GET /api/admin/orders — every order (view-only; no status updates in this stage). */
router.get('/', orderController.adminList);

module.exports = router;
