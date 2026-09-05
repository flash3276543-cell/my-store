const express = require('express');

const authRoutes = require('./auth');
const licenseRoutes = require('./licenses');
const adminLicenseRoutes = require('./adminLicenses');
const adminCustomerRoutes = require('./adminCustomers');
const productRoutes = require('./products');
const adminProductRoutes = require('./adminProducts');
const orderRoutes = require('./orders');
const adminOrderRoutes = require('./adminOrders');
const { publicRouter: settingsRoutes, adminRouter: adminSettingsRoutes } = require('./settings');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/licenses', licenseRoutes);
router.use('/admin/licenses', adminLicenseRoutes);
router.use('/admin/customers', adminCustomerRoutes);
router.use('/products', productRoutes);
router.use('/admin/products', adminProductRoutes);
router.use('/orders', orderRoutes);
router.use('/admin/orders', adminOrderRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin/settings', adminSettingsRoutes);

module.exports = router;
