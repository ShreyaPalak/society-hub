const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

/**
 * Verifies the JWT on every request to a protected route. The token's role
 * claim is the ONLY source of truth for authorization decisions on the
 * server — the frontend hiding a button is a UX nicety, not security.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { id, role, name, iat, exp }
    req.user = payload;
    return next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired token. Please log in again.'));
  }
}

/**
 * Restricts a route to one or more roles. Must run AFTER authenticate().
 * A resident hitting an admin-only endpoint directly (Postman, curl, a
 * tampered frontend build) is rejected here regardless of what the UI does.
 *
 * Usage: router.patch('/complaints/:id/status', authenticate, authorize('admin'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, `Forbidden: requires role ${allowedRoles.join(' or ')}.`));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
