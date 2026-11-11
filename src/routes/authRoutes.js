const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const { loginRateLimiter } = require('../middleware/rateLimiter');

// Basic email regex validator
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/login
 * Authenticates admin credentials and establishes a secure session.
 */
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Both email and password are required.'
      });
    }

    const trimmedEmail = String(email).trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Please provide a valid email address format.'
      });
    }

    // Verify against bcrypt hash
    const admin = await adminService.verifyCredentials(trimmedEmail, String(password));
    if (!admin) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password.'
      });
    }

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to establish secure session.'
        });
      }

      // Store authenticated admin in session
      req.session.admin = {
        email: admin.email,
        role: admin.role,
        authenticatedAt: new Date().toISOString()
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to save session state.'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Login successful.',
          admin: {
            email: admin.email,
            role: admin.role
          }
        });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during login.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroys the server-side session and clears the session cookie.
 */
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout session destruction error:', err);
        return res.status(500).json({
          error: 'Logout Error',
          message: 'Could not log out at this time.'
        });
      }

      res.clearCookie('audioflow.sid');
      return res.status(200).json({
        success: true,
        message: 'Session destroyed. Successfully logged out.'
      });
    });
  } else {
    res.clearCookie('audioflow.sid');
    return res.status(200).json({
      success: true,
      message: 'No active session found.'
    });
  }
});

/**
 * GET /api/auth/session
 * Check current authentication status
 */
router.get('/session', (req, res) => {
  if (req.session && req.session.admin) {
    return res.status(200).json({
      authenticated: true,
      admin: {
        email: req.session.admin.email,
        role: req.session.admin.role,
        authenticatedAt: req.session.admin.authenticatedAt
      }
    });
  }

  return res.status(200).json({
    authenticated: false,
    admin: null
  });
});

module.exports = router;

