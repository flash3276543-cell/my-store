const { validationResult } = require('express-validator');

/** Runs after express-validator's chain(...) calls; rejects with 400 on any failure. */
function runValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request.',
        details: result.array().map((e) => ({ field: e.path, message: e.msg })),
      },
    });
  }
  next();
}

module.exports = { runValidation };
