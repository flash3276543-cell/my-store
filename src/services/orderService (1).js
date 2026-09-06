const pool = require('../database/pool');
const licenseService = require('./licenseService');

class OrderError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// Shared SELECT used by both the customer ("my orders") and admin
// ("all orders") list views — one row per order, joined to its single
// order_item and the product it references. This project's checkout
// flow is one-product-per-order today (matching the existing manual,
// cash-based sales model), so a single JOIN is enough; order_items
// still supports multiple rows per order in the schema if that ever
// changes later.
const ORDER_SELECT = `
  SELECT
    o.id,
    o.user_id,
    o.customer_email,
    o.total_cents,
    o.currency,
    o.payment_method,
    o.payment_status,
    o.order_status,
    o.created_at,
    o.updated_at,
    oi.product_id,
    p.name AS product_name,
    p.slug AS product_slug
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
`;

/**
 * Creates an order for a single product. Does NOT create a license or
 * touch payment — this stage is data-entry only ("do not implement
 * automatic payments yet"). payment_status/order_status both start at
 * 'pending' by the column defaults added in migration 006.
 */
async function createOrder({ userId, customerEmail, productId, paymentMethod }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: productRows } = await client.query(
      'SELECT id, price_cents, currency FROM products WHERE id = $1 AND is_active = true',
      [productId]
    );
    const product = productRows[0];
    if (!product) {
      throw new OrderError('PRODUCT_NOT_FOUND', 'Product not found or unavailable.', 404);
    }

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (user_id, customer_email, total_cents, currency, payment_method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId || null, customerEmail, product.price_cents, product.currency, paymentMethod || null]
    );
    const orderId = orderRows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, unit_price_cents, quantity)
       VALUES ($1, $2, $3, 1)`,
      [orderId, product.id, product.price_cents]
    );

    await client.query('COMMIT');
    return getOrderById(orderId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getOrderById(orderId) {
  const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  return rows[0] || null;
}

/** Customer: their own orders, matched the same way licenses are — by user_id or customer_email. */
async function getOrdersForCustomer({ userId, email }) {
  const { rows } = await pool.query(
    `${ORDER_SELECT} WHERE o.user_id = $1 OR o.customer_email = $2 ORDER BY o.created_at DESC`,
    [userId || null, email]
  );
  return rows;
}

/** Admin: every order, newest first. View-only for this stage — no status updates yet. */
async function getAllOrdersForAdmin() {
  const { rows } = await pool.query(`${ORDER_SELECT} ORDER BY o.created_at DESC`);
  return rows;
}

// --- Manual, multi-method payment flow ---------------------------------
//
//   Payment Method -> Order -> Payment Verification -> Verified Payment
//   -> License Generation
//
// License generation is never tied to a specific payment method — it
// only ever happens once an order's payment_status becomes 'verified',
// regardless of whether that was CCP, cash, or (later) anything else.
// This reuses the EXISTING licenseService.createLicense() unchanged.

/**
 * Customer: "I HAVE PAID" for a CCP order — records a payment attempt
 * row (using the existing, provider-agnostic `payments` table) with
 * whatever reference/date they provide. Does NOT change payment_status —
 * it stays 'pending' until an admin manually verifies it.
 */
async function submitPaymentProof({ orderId, userId, email, providerRef, paymentDate, note }) {
  const { rows } = await pool.query(
    `SELECT id, total_cents, currency, payment_method, payment_status
     FROM orders WHERE id = $1 AND (user_id = $2 OR customer_email = $3)`,
    [orderId, userId || null, email]
  );
  const order = rows[0];
  if (!order) {
    throw new OrderError('ORDER_NOT_FOUND', 'Order not found.', 404);
  }
  if (order.payment_status !== 'pending') {
    throw new OrderError('ORDER_NOT_PENDING', 'This order is not awaiting payment.', 409);
  }

  await pool.query(
    `INSERT INTO payments (order_id, provider, provider_ref, status, amount_cents, currency, raw_payload)
     VALUES ($1, $2, $3, 'PENDING', $4, $5, $6::jsonb)`,
    [
      orderId,
      order.payment_method || 'ccp',
      providerRef || null,
      order.total_cents,
      order.currency,
      JSON.stringify({ paymentDate: paymentDate || null, note: note || null }),
    ]
  );
  return { orderId, submitted: true };
}

/**
 * Admin: verifies a pending payment (works the same for CCP, cash, or
 * any future method — nothing here is method-specific). Marks the
 * order verified/completed, marks any matching payment attempt as
 * CONFIRMED, then generates a license via the untouched, existing
 * license system.
 */
async function verifyOrder(orderId) {
  const { rows } = await pool.query(
    `UPDATE orders SET payment_status = 'verified', order_status = 'completed'
     WHERE id = $1 AND payment_status = 'pending'
     RETURNING id, user_id, customer_email`,
    [orderId]
  );
  const order = rows[0];
  if (!order) {
    throw new OrderError('ORDER_NOT_PENDING', 'Order is not pending or was not found.', 409);
  }

  await pool.query(
    `UPDATE payments SET status = 'CONFIRMED', confirmed_at = now() WHERE order_id = $1 AND status = 'PENDING'`,
    [orderId]
  );

  const { rows: itemRows } = await pool.query(
    'SELECT product_id FROM order_items WHERE order_id = $1 LIMIT 1',
    [orderId]
  );
  const productId = itemRows[0] && itemRows[0].product_id;

  // Reuse the EXISTING license generation system exactly as the manual
  // admin flow already does — no changes to licenseService.js.
  const { license, plaintextKey } = await licenseService.createLicense({
    productId,
    orderId,
    userId: order.user_id,
    customerEmail: order.customer_email,
  });

  return { orderId, license, licenseKey: plaintextKey };
}

/** Admin: rejects a pending payment. Never used for anything already verified. */
async function rejectOrder(orderId) {
  const { rows } = await pool.query(
    `UPDATE orders SET payment_status = 'rejected', order_status = 'cancelled'
     WHERE id = $1 AND payment_status = 'pending'
     RETURNING id`,
    [orderId]
  );
  if (!rows[0]) {
    throw new OrderError('ORDER_NOT_PENDING', 'Order is not pending or was not found.', 409);
  }
  await pool.query(`UPDATE payments SET status = 'FAILED' WHERE order_id = $1 AND status = 'PENDING'`, [orderId]);
  return { orderId };
}

module.exports = {
  OrderError,
  createOrder,
  getOrdersForCustomer,
  getAllOrdersForAdmin,
  submitPaymentProof,
  verifyOrder,
  rejectOrder,
};
