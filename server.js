require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const adminService = require('./src/services/adminService');
const dashboardService = require('./src/services/dashboardService');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const { requireAuth, redirectIfAuthenticated } = require('./src/middleware/auth');
const { connectDB, getConnectionStatus } = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust first proxy if behind reverse proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Server-side session configuration
app.use(session({
  name: 'audioflow.sid',
  secret: process.env.SESSION_SECRET || 'audioflow_default_dev_secret_change_in_production_1028301',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true, // Prevents client-side JS from reading cookie
    sameSite: 'lax', // CSRF protection
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize MongoDB Database Connection & Hydrate Cache
connectDB().then(() => {
  dashboardService.hydrateFromDB().catch(err => {
    console.warn('Dashboard DB hydration notice:', err.message);
  });
}).catch(err => {
  console.warn('MongoDB connection notice:', err.message);
});

// Initialize Admin Credentials from Environment Variables (Hashed with bcrypt)
adminService.initAdmin().catch(err => {
  console.error('Failed to initialize admin credentials:', err);
});

// Authentication API routes (Rate-limited login, logout, session status)
app.use('/api/auth', authRoutes);

// Protected Admin API routes
app.use('/api/admin', adminRoutes);

// Public Recipient routes (/listen/:slug, /api/listen/:slug, streaming & telemetry)
app.use(publicRoutes);

// Health-Check API Endpoint (Preserved from Phase 1)
app.get('/api/health', (req, res) => {
  const dbStatus = getConnectionStatus();
  res.status(200).json({
    status: 'healthy',
    service: 'AudioFlow Platform API',
    version: '1.2.0',
    phase: 'Phase 5 - MongoDB & Cloud Storage',
    database: {
      type: 'MongoDB',
      connected: dbStatus.isConnected,
      state: dbStatus.state,
      host: dbStatus.host
    },
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Protected Admin Page Routes (Checked before static files)
app.get(['/admin', '/admin.html'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Login Page Route (Redirects to /admin if already logged in)
app.get(['/login', '/login.html'], redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Static files (serves public directory with browser cache enabled in production)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Explicit route for homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint '${req.originalUrl}' does not exist.`
  });
});

// Catch-all redirect to homepage for unhandled web navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Express Error Handler (Protects API from ever returning HTML errors to JSON clients)
app.use((err, req, res, next) => {
  console.error('Unhandled application error:', err.message || err);
  const status = err.status || err.statusCode || 500;
  const isApi = req.originalUrl.startsWith('/api/') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

  if (isApi) {
    return res.status(status).json({
      success: false,
      error: err.message || 'An unexpected server error occurred.'
    });
  }

  res.status(status).send(`Server Error: ${err.message || 'Something went wrong.'}`);
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎵 AudioFlow Web Application (Phase 5 - MongoDB Setup)`);
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`🔐 Admin Login:       http://localhost:${PORT}/login`);
  console.log(`🛡️  Admin Protected:   http://localhost:${PORT}/admin`);
  console.log(`🍃 Database (MongoDB): http://localhost:${PORT}/api/health`);
  console.log(`🩺 Health-Check API:  http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} in use, standalone listener skipped.`);
  } else {
    console.error('Server error:', err);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = { app, server };
