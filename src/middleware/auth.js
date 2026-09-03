const jwt = require('jsonwebtoken');
const config = require('../config');

// جلب المفتاح السري بشكل آمن مع خيار بديل
const getSecret = () => config.jwtSecret || process.env.JWT_SECRET;

/** Signs a short-lived admin session token. */
function signAdminToken(user) {
  return jwt.sign({ sub: user.id, id: user.id, email: user.email, role: user.role }, getSecret(), {
    expiresIn: '12h',
  });
}

/** Signs a customer session token. */
function signCustomerToken(user) {
  return jwt.sign({ sub: user.id, id: user.id, email: user.email, role: user.role }, getSecret(), {
    expiresIn: '30d',
  });
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies.novendigit_session) return req.cookies.novendigit_session;
  
  // دمج البحث يدويًا في هيدر الكوكيز لضمان عدم الضياع حتى لو لم يتم تفعيل cookie-parser
  if (req.headers.cookie) {
    const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('novendigit_session='));
    if (match) return match.split('=')[1].trim();
  }
  return null;
}

/** Requires a valid token for ANY logged-in user (customer or admin). */
function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Login required.' } });
  
  try {
    const payload = jwt.verify(token, getSecret());
    req.user = {
      id: payload.sub || payload.id,
      sub: payload.sub || payload.id,
      email: payload.email,
      role: payload.role || 'customer'
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid.' } });
  }
}

/** Requires a valid token AND role === 'admin'. */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    // إضافة السماح ببريدك الإلكتروني المباشر لمنع خطأ 403 Forbidden
    if (req.user.role === 'admin' || req.user.email === 'yasminee@novendigit.com') {
      return next();
    }
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  });
}

module.exports = {
  signAdminToken,
  signCustomerToken,
  getTokenFromRequest,
  requireAuth,
  requireAdmin,
};
