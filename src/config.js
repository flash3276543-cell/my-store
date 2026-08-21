require('dotenv').config();

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined || val === '') {
    // eslint-disable-next-line no-console
    console.warn(`[config] Warning: environment variable ${name} is not set.`);
  }
  return val;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  appUrl: required('APP_URL', 'http://localhost:4000'),
  storeUrl: required('STORE_URL', 'http://localhost:3000'),

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  licenseStateSecret: required('LICENSE_STATE_SECRET'),

  adminEmail: process.env.ADMIN_EMAIL,
  adminBootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD,

  paymentProvider: process.env.PAYMENT_PROVIDER || 'none',
  paymentSecret: process.env.PAYMENT_SECRET,
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,

  emailProvider: process.env.EMAIL_PROVIDER || 'none',
  emailApiKey: process.env.EMAIL_API_KEY,
  emailFrom: process.env.EMAIL_FROM || 'no-reply@novendigit.com',

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
};
