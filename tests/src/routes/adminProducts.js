const express = require('express');
const { body, param } = require('express-validator');
const productController = require('../controllers/productController');
const { runValidation } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

const productFields = [
  body('slug').isString().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Valid slug is required.'),
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('shortDescription').optional({ nullable: true }).isString().trim(),
  body('description').optional({ nullable: true }).isString().trim(),
  body('priceCents').isInt({ min: 0 }).withMessage('priceCents must be a non-negative integer.'),
  body('currency').isString().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code.'),
  body('version').isString().trim().notEmpty().withMessage('Version is required.'),
  body('imageUrl').optional({ nullable: true }).isURL().withMessage('imageUrl must be a valid URL.'),
];

const optionalProductFields = [
  body('slug').optional().isString().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Valid slug is required.'),
  body('name').optional().isString().trim().notEmpty().withMessage('Name is required.'),
  body('shortDescription').optional({ nullable: true }).isString().trim(),
  body('description').optional({ nullable: true }).isString().trim(),
  body('priceCents').optional().isInt({ min: 0 }).withMessage('priceCents must be a non-negative integer.'),
  body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code.'),
  body('version').optional().isString().trim().notEmpty().withMessage('Version is required.'),
  body('imageUrl').optional({ nullable: true }).isURL().withMessage('imageUrl must be a valid URL.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean.'),
];

router.post('/', productFields, runValidation, productController.create);

router.patch(
  '/:id',
  [param('id').isUUID().withMessage('Invalid product id.'), ...optionalProductFields],
  runValidation,
  productController.update
);

router.post(
  '/:id/deactivate',
  [param('id').isUUID().withMessage('Invalid product id.')],
  runValidation,
  productController.deactivate
);

module.exports = router;