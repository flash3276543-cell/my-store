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
    const user = await authService.register(email, password);
    const { token } = await authService.login(email, password);
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
    const token = req.cookies.novendigit_session || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) return res.status(401).json({ message: 'Unauthenticated' });
    const user = await authService.verifyToken(token);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminLogin, login, register, me };
