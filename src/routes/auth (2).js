const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { runValidation } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');

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

/** POST /api/auth/register — create a new customer account. */
router.post(
  '/register',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
  ],
  runValidation,
  authController.register
);

/** POST /api/auth/login — customer login. */
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

/** GET /api/auth/me — the logged-in user's own profile (customer or admin). */
router.get('/me', requireAuth, authController.me);

/** POST /api/auth/logout — clears the session cookie for admin or customer. */
router.post('/logout', authController.logout);

module.exports = router;
