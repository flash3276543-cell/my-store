const productService = require('../services/productService');

async function download(req, res, next) {
  try {
    const filePath = await productService.getDownloadPath(req.params.id, req.user);
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err);
  }
}

async function listPublic(req, res, next) {
  try {
    res.json({ data: await productService.listPublicProducts() });
  } catch (err) {
    next(err);
  }
}

async function getPublic(req, res, next) {
  try {
    const product = await productService.getPublicProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    res.status(201).json({ data: await productService.createProduct(req.body) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const product = await productService.deactivateProduct(req.params.id);
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPublic, getPublic, download, create, update, deactivate };