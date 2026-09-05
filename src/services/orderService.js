const pool = require('../database/pool');

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

module.exports = { OrderError, createOrder, getOrdersForCustomer, getAllOrdersForAdmin };
