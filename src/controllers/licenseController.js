const licenseService = require('../services/licenseService');

function clientMeta(req) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

/** GET /api/licenses/mine — جلب مفاتيح الزبون المسجل حالياً */
async function getMyLicenses(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const customerEmail = req.user?.email;

    if (!userId && !customerEmail) {
      return res.status(401).json({ error: { message: 'Unauthenticated' } });
    }

    const licenses = await licenseService.getLicensesForUser({ userId, customerEmail });
    res.json({ data: licenses });
  } catch (err) {
    next(err);
  }
}

/** POST /api/licenses/activate */
async function activate(req, res, next) {
  try {
    const { licenseKey, productSlug, installationId } = req.body;
    const result = await licenseService.activateLicense({
      plaintextKey: licenseKey,
      productSlug,
      installationId,
      ...clientMeta(req),
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/** POST /api/licenses/verify */
async function verify(req, res, next) {
  try {
    const { licenseKey, productSlug, installationId } = req.body;
    const result = await licenseService.verifyLicense({
      plaintextKey: licenseKey,
      productSlug,
      installationId,
      ...clientMeta(req),
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/** GET /api/licenses/:id/status */
async function status(req, res, next) {
  try {
    const license = await licenseService.getLicenseStatus(req.params.id);
    if (!license) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'License not found.' } });
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses */
async function adminCreate(req, res, next) {
  try {
    const { productId, customerEmail, orderId } = req.body;
    const { license, plaintextKey } = await licenseService.createLicense({
      productId,
      customerEmail,
      orderId: orderId || null,
    });
    res.status(201).json({ data: { license, licenseKey: plaintextKey } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses/:id/reset */
async function adminReset(req, res, next) {
  try {
    const license = await licenseService.resetActivation(req.params.id, req.user?.sub || req.user?.id);
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses/:id/revoke */
async function adminRevoke(req, res, next) {
  try {
    const license = await licenseService.revokeLicense(req.params.id, req.user?.sub || req.user?.id);
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses/:id/reactivate */
async function adminReactivate(req, res, next) {
  try {
    const license = await licenseService.reactivateLicense(req.params.id, req.user?.sub || req.user?.id);
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyLicenses,
  activate,
  verify,
  status,
  adminCreate,
  adminReset,
  adminRevoke,
  adminReactivate,
};
