const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { runValidation } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, authController.profile);

router.post(
  '/admin/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isString().notEmpty().withMessage('Password is required.'),
  ],
  runValidation,
  authController.adminLogin
);

router.post(
  '/register',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  runValidation,
  authController.customerRegister
);

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isString().notEmpty().withMessage('Password is required.'),
  ],
  runValidation,
  authController.customerLogin
);

module.exports = router;
