const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const config = require('../config');

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password, { requireRole: 'admin' });
    res.cookie('novendigit_session', token, { ...cookieOptions, maxAge: 12 * 60 * 60 * 1000 })
       .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password);
    res.cookie('novendigit_session', token, cookieOptions)
       .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await authService.createUser({ email, password, role: 'customer' });
    const { token } = await authService.login(email, password);
    res.cookie('novendigit_session', token, cookieOptions)
       .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie('novendigit_session', cookieOptions);
  return res.json({ message: 'Logged out successfully' });
}

async function me(req, res, next) {
  try {
    if (req.user) return res.json({ data: req.user });
    
    let token = req.cookies?.novendigit_session || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('novendigit_session='));
      if (match) token = match.split('=')[1].trim();
    }

    if (!token) return res.status(401).json({ message: 'Unauthenticated' });

    const secret = config.jwtSecret || process.env.JWT_SECRET;
    try {
      const payload = jwt.verify(token, secret);
      return res.json({ data: { id: payload.sub || payload.id, email: payload.email, role: payload.role || 'customer' } });
    } catch (jwtErr) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { adminLogin, login, register, logout, me };
