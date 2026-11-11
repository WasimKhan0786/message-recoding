/**
 * Authentication Middleware
 * Enforces session-based authentication for protected admin routes.
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }

  // Handle API vs page requests
  const isApiRequest = req.originalUrl.startsWith('/api/') || 
                       req.xhr || 
                       (req.headers.accept && req.headers.accept.includes('application/json'));

  if (isApiRequest) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required to access this resource.'
    });
  }

  // Redirect page visits to login page with return url
  const redirectUrl = encodeURIComponent(req.originalUrl || '/admin');
  return res.redirect(`/login.html?redirect=${redirectUrl}`);
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.admin) {
    return res.redirect('/admin');
  }
  return next();
}

module.exports = {
  requireAuth,
  redirectIfAuthenticated
};

