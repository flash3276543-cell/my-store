const orderService = require('../services/orderService');

/** POST /api/orders — a logged-in customer creates an order for one product. */
async function create(req, res, next) {
  try {
    const { productId, paymentMethod } = req.body;
    const order = await orderService.createOrder({
      userId: req.user.sub,
      customerEmail: req.user.email,
      productId,
      paymentMethod: paymentMethod || null,
    });
    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
}

/** GET /api/orders/mine — the logged-in customer's own orders (account page). */
async function mine(req, res, next) {
  try {
    const orders = await orderService.getOrdersForCustomer({ userId: req.user.sub, email: req.user.email });
    res.json({ data: orders });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/orders — every order, for the admin panel. View-only for this stage. */
async function adminList(req, res, next) {
  try {
    const orders = await orderService.getAllOrdersForAdmin();
    res.json({ data: orders });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, mine, adminList };
