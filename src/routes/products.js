const express = require('express');
const { param } = require('express-validator');
const productController = require('../controllers/productController');
const { runValidation } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/products
 * Public, minimal listing — enough to test the license flow end to end.
 * The full store/shop product API (images, descriptions, pagination,
 * admin CRUD) is built in the store stage, not here.
 */
router.get('/', productController.listPublic);

router.get(
	'/:id/download',
	requireAuth,
	[param('id').isUUID().withMessage('Invalid product id.')],
	runValidation,
	productController.download
);

router.get(
	'/:slug',
	[param('slug').isString().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Invalid product slug.')],
	runValidation,
	productController.getPublic
);

module.exports = router;
