const adminCustomerService = require('../services/adminCustomerService');

async function list(req, res, next) {
  try {
    res.json({ data: await adminCustomerService.listCustomers() });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };