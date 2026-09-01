const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { runValidation } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// 1. مسار أدمن المتجر
if (authController.adminLogin) {
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
}

// 2. مسارات الزبائن
const loginHandler = authController.login || authController.customerLogin || authController.loginCustomer;
const registerHandler = authController.register || authController.customerRegister || authController.registerCustomer;
const meHandler = authController.me || authController.getMe || authController.getCurrentUser;

if (loginHandler) {
  router.post(
    '/login',
    loginLimiter,
    [
      body('email').isEmail().withMessage('Valid email is required.'),
      body('password').isString().notEmpty().withMessage('Password is required.'),
    ],
    runValidation,
    loginHandler
  );
}

if (registerHandler) {
  router.post(
    '/register',
    loginLimiter,
    [
      body('email').isEmail().withMessage('Valid email is required.'),
      body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    ],
    runValidation,
    registerHandler
  );
}

if (meHandler) {
  router.get('/me', meHandler);
}

module.exports = router;
