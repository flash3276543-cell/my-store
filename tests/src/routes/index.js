const express = require('express');

const authRoutes = require('./auth');
const licenseRoutes = require('./licenses');
const adminLicenseRoutes = require('./adminLicenses');
const productRoutes = require('./products');
const adminProductRoutes = require('./adminProducts');
const adminCustomerRoutes = require('./adminCustomers');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/licenses', licenseRoutes);
router.use('/admin/licenses', adminLicenseRoutes);
router.use('/admin/products', adminProductRoutes);
router.use('/admin/customers', adminCustomerRoutes);
router.use('/products', productRoutes);

module.exports = router;
