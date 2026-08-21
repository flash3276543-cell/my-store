const licenseService = require('../services/licenseService');

function clientMeta(req) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
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

/** GET /api/licenses/:id/status — customer-owned licenses or any admin license */
async function status(req, res, next) {
  try {
    const license = await licenseService.getLicenseStatus(req.params.id, req.user);
    if (!license) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'License not found.' } });
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

/** GET /api/licenses/mine — customers see their own licenses; admins see all licenses. */
async function listMine(req, res, next) {
  try {
    const licenses = await licenseService.listLicensesForUser(req.user);
    res.json({ data: licenses });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses — generate a new license manually */
async function adminCreate(req, res, next) {
  try {
    const { productId, customerEmail, userId, orderId } = req.body;
    const { license, plaintextKey } = await licenseService.createLicense({
      productId,
      customerEmail,
      userId: userId || null,
      orderId: orderId || null,
    });
    // Plaintext key is returned ONLY in this response — admin must copy
    // it now. It is never retrievable again after this call.
    res.status(201).json({ data: { license, licenseKey: plaintextKey } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses/:id/reset */
async function adminReset(req, res, next) {
  try {
    const license = await licenseService.resetActivation(req.params.id, req.user.sub);
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses/:id/revoke */
async function adminRevoke(req, res, next) {
  try {
    const license = await licenseService.revokeLicense(req.params.id, req.user.sub);
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/licenses/:id/reactivate */
async function adminReactivate(req, res, next) {
  try {
    const license = await licenseService.reactivateLicense(req.params.id, req.user.sub);
    res.json({ data: license });
  } catch (err) {
    next(err);
  }
}

module.exports = { activate, verify, status, listMine, adminCreate, adminReset, adminRevoke, adminReactivate };
