const multer = require('multer');
const ApiError = require('../utils/ApiError');

// 404 fallback - must be registered after all routes.
function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Single place where every thrown/forwarded error becomes a JSON response.
// The frontend relies on this shape ({ error: { message, details } }) to
// drive toast notifications instead of showing a blank crash screen.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Max upload size is ${process.env.MAX_UPLOAD_MB || 5}MB.`
        : `Upload error: ${err.message}`;
    return res.status(400).json({ error: { message, code: err.code } });
  }

  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message || 'Internal server error.';

  if (statusCode === 500) {
    // eslint-disable-next-line no-console
    console.error('[UNHANDLED ERROR]', err);
  }

  res.status(statusCode).json({
    error: {
      message,
      details: err.details || undefined,
    },
  });
}

module.exports = { notFound, errorHandler };
