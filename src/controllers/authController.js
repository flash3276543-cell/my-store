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

async function customerRegister(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await authService.createUser({ email, password, role: 'customer' });
    const { token } = await authService.login(email, password, { requireRole: 'customer' });
    res
      .cookie('novendigit_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({ data: { token, user } });
  } catch (err) {
    if (err.code === '23505') {
      err = new authService.AuthError('EMAIL_ALREADY_REGISTERED', 'An account with that email already exists.', 409);
    }
    next(err);
  }
}

async function customerLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password, { requireRole: 'customer' });
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

async function profile(req, res, next) {
  try {
    const user = await authService.getUserProfile(req.user.sub);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminLogin, customerRegister, customerLogin, profile };
