const authService = require('../services/authService');

const SESSION_COOKIE = 'novendigit_session';

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
  };
}

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password, { requireRole: 'admin' });
    res
      .cookie(SESSION_COOKIE, token, cookieOptions(12 * 60 * 60 * 1000))
      .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/register — customer self-registration. */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.register({ email, password });
    res
      .status(201)
      .cookie(SESSION_COOKIE, token, cookieOptions(30 * 24 * 60 * 60 * 1000))
      .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/login — customer login (admins must use /api/auth/admin/login). */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password, { requireRole: 'customer' });
    res
      .cookie(SESSION_COOKIE, token, cookieOptions(30 * 24 * 60 * 60 * 1000))
      .json({ data: { token, user } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me — returns the currently authenticated user (from a fresh DB read, not just the JWT payload). */
async function me(req, res, next) {
  try {
    const user = await authService.findUserById(req.user.sub);
    if (!user) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Login required.' } });
    }
    // Flat shape: `data` IS the user record (id/email/role), matching the
    // shape every other endpoint returns. A previous version nested this
    // as `data: { user }`, which silently broke any frontend reading
    // `response.data.email` directly (it always came back undefined).
    res.json({ data: { id: user.id, email: user.email, role: user.role, createdAt: user.created_at } });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminLogin, register, login, me };
