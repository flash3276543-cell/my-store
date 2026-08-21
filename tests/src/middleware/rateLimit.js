const rateLimit = require('express-rate-limit');
const config = require('../config');

/** General-purpose limiter for most API routes. */
const standardLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});

/**
 * Stricter limiter for license activation/verification endpoints,
 * since these are the most attractive target for brute-forcing key
 * guesses. Keyed by IP; tune further with a per-account limiter once
 * customer accounts exist if needed.
 */
const licenseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many license requests. Please try again later.' } },
});

/** Even stricter limiter for admin login, to slow brute-force attempts. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
});

module.exports = { standardLimiter, licenseLimiter, loginLimiter };
