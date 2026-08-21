/**
 * Central error handler.
 *
 * Known, expected errors (LicenseError and friends) carry a `code`,
 * a safe user-facing `message`, and an `httpStatus`. Anything else is
 * an unexpected server error: log the real details server-side, but
 * return only a generic message to the client (PART 37).
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'This endpoint does not exist.' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.httpStatus) {
    return res.status(err.httpStatus).json({ error: { code: err.code || 'ERROR', message: err.message } });
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled error]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our end. Please try again shortly.' } });
}

module.exports = { notFoundHandler, errorHandler };
