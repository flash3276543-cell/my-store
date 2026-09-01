const authService = require('../services/authService');
const { signCustomerToken } = require('../middleware/auth');

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password, { requireRole: 'admin' });
    res
      .cookie('novendigit_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000,
      })
      .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password);
    res
      .cookie('novendigit_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    // تم التعديل إلى createUser ليتوافق مع authService.js
    const user = await authService.createUser({ email, password, role: 'customer' });
    const token = signCustomerToken(user);
    res
      .cookie('novendigit_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    // تعتمد على req.user الذي يمرر بواسطة middleware التوثيق
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });
    res.json({ data: req.user });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminLogin, login, register, me };
