const pool = require('../database/pool');
const fs = require('fs/promises');
const path = require('path');

const publicColumns = 'id, slug, name, short_description, description, price_cents, currency, version, is_active, image_url, created_at, updated_at';

class ProductDownloadError extends Error {
  constructor(code, message, httpStatus) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function listPublicProducts() {
  const { rows } = await pool.query(
    `SELECT ${publicColumns}
     FROM products
     WHERE is_active = true
     ORDER BY created_at ASC`
  );
  return rows;
}

async function getPublicProductBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${publicColumns}
     FROM products
     WHERE slug = $1 AND is_active = true`,
    [slug]
  );
  return rows[0] || null;
}

async function getDownloadPath(productId, user) {
  const isAdmin = user && user.role === 'admin';
  const query = isAdmin
    ? `SELECT p.file_path
       FROM products p
       WHERE p.id = $1 AND p.is_active = true`
    : `SELECT p.file_path
       FROM products p
       JOIN licenses l ON l.product_id = p.id
       WHERE p.id = $1 AND p.is_active = true
         AND l.user_id = $2 AND l.status = 'ACTIVE'`;
  const params = isAdmin ? [productId] : [productId, user && user.sub];
  const { rows } = await pool.query(query, params);
  const product = rows[0];
  if (!product) {
    throw new ProductDownloadError('DOWNLOAD_FORBIDDEN', 'You do not have access to this product.', isAdmin ? 404 : 403);
  }
  if (!product.file_path) {
    throw new ProductDownloadError('FILE_NOT_FOUND', 'Product file is not available.', 404);
  }

  const filePath = path.resolve(product.file_path);
  try {
    const file = await fs.stat(filePath);
    if (!file.isFile()) throw new Error('Not a file');
  } catch {
    throw new ProductDownloadError('FILE_NOT_FOUND', 'Product file is not available.', 404);
  }
  return filePath;
}

async function createProduct(product) {
  const { rows } = await pool.query(
    `INSERT INTO products
       (slug, name, short_description, description, price_cents, currency, version, image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     RETURNING ${publicColumns}`,
    [
      product.slug,
      product.name,
      product.shortDescription || null,
      product.description || null,
      product.priceCents,
      product.currency.toUpperCase(),
      product.version,
      product.imageUrl || null,
    ]
  );
  return rows[0];
}

async function updateProduct(productId, product) {
  const fields = [];
  const values = [];
  const allowedFields = {
    slug: 'slug',
    name: 'name',
    shortDescription: 'short_description',
    description: 'description',
    priceCents: 'price_cents',
    currency: 'currency',
    version: 'version',
    imageUrl: 'image_url',
    isActive: 'is_active',
  };

  for (const [input, column] of Object.entries(allowedFields)) {
    if (product[input] !== undefined) {
      values.push(input === 'currency' ? product[input].toUpperCase() : product[input]);
      fields.push(`${column} = $${values.length}`);
    }
  }
  if (fields.length === 0) return null;

  values.push(productId);
  const { rows } = await pool.query(
    `UPDATE products
     SET ${fields.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${publicColumns}`,
    values
  );
  return rows[0] || null;
}

async function deactivateProduct(productId) {
  const { rows } = await pool.query(
    `UPDATE products
     SET is_active = false
     WHERE id = $1
     RETURNING ${publicColumns}`,
    [productId]
  );
  return rows[0] || null;
}

module.exports = { ProductDownloadError, listPublicProducts, getPublicProductBySlug, getDownloadPath, createProduct, updateProduct, deactivateProduct };