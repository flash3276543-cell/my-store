const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { runValidation } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// 1. مسار تسجيل دخول الأدمن
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

// 2. مسار تسجيل دخول المشتركين (Storefront Login)
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isString().notEmpty().withMessage('Password is required.'),
  ],
  runValidation,
  authController.login
);

// 3. مسار إنشاء حساب جديد للمشتركين (Storefront Register)
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  runValidation,
  authController.register
);

// 4. مسار جلب بيانات المستخدم الحالي (Session Check)
router.get('/me', authController.me);

module.exports = router;
