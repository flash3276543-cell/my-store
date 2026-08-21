const express = require('express');
const adminCustomerController = require('../controllers/adminCustomerController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);
router.get('/', adminCustomerController.list);

module.exports = router;