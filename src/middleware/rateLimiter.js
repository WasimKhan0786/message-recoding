const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for sensitive authentication endpoints (e.g., login).
 * Limits repeated failed attempts from the same IP address.
 * Generous threshold in development so legitimate testing/logins never get locked out.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // 100 attempts in dev mode
  skipSuccessfulRequests: true, // Successful logins never count against rate limit
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many login attempts from this IP. Please try again after 15 minutes.'
  },
  statusCode: 429
});

module.exports = {
  loginRateLimiter
};

