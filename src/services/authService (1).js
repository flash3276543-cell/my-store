const bcrypt = require('bcrypt');
const pool = require('../database/pool');
const { signAdminToken, signCustomerToken } = require('../middleware/auth');

const SALT_ROUNDS = 12;

class AuthError extends Error {
  constructor(code, message, httpStatus = 401) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

/** Generic login used by both admin and customer login routes. */
async function login(email, password, { requireRole } = {}) {
  const user = await findUserByEmail(email);
  // Deliberately generic error message + same code path whether the
  // email doesn't exist or the password is wrong, to avoid leaking
  // which emails are registered.
  if (!user) throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');

  if (requireRole && user.role !== requireRole) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = user.role === 'admin' ? signAdminToken(user) : signCustomerToken(user);
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

/** Creates a new user record with a hashed password. Used by the admin bootstrap seed and customer registration. */
async function createUser({ email, password, role = 'customer' }) {
  const passwordHash = await hashPassword(password);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email, passwordHash, role]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation on users.email
      throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.', 409);
    }
    throw err;
  }
}

/** Fetches a user by id, without the password hash — used for GET /api/auth/me. */
async function findUserById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Customer self-registration. Deliberately always creates role='customer' —
 * admins are only ever created via the bootstrap seed, never through this
 * public endpoint.
 */
async function register({ email, password }) {
  const user = await createUser({ email, password, role: 'customer' });
  const token = signCustomerToken(user);
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

module.exports = {
  AuthError,
  login,
  register,
  createUser,
  findUserByEmail,
  findUserById,
  hashPassword,
};
