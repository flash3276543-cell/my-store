const jwt = require('jsonwebtoken');
const config = require('../config');

/** Signs a short-lived admin session token. */
function signAdminToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: '12h',
  });
}

/** Signs a customer session token. */
function signCustomerToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: '30d',
  });
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies.novendigit_session) return req.cookies.novendigit_session;
  return null;
}

/** Requires a valid token for ANY logged-in user (customer or admin). */
function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Login required.' } });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid.' } });
  }
}

/** Requires a valid token AND role === 'admin'. */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
    }
    next();
  });
}

module.exports = { signAdminToken, signCustomerToken, requireAuth, requireAdmin };
