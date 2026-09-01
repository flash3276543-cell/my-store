const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { runValidation } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

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
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isString().notEmpty().withMessage('Password is required.'),
  ],
  runValidation,
  authController.login
);

router.post(
  '/register',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  runValidation,
  authController.register
);

router.get('/me', authController.me);

module.exports = router;
