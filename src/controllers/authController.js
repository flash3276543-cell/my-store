const authService = require('../services/authService');

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

module.exports = { adminLogin };
