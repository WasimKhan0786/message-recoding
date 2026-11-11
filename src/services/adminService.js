const bcrypt = require('bcryptjs');

let adminUser = null;

/**
 * Initialize admin account from environment variables.
 * Hashes the password with bcrypt on startup.
 * Never stores the plain-text password in memory.
 */
async function initAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@audioflow.local').trim().toLowerCase();
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!rawPassword) {
    console.warn('⚠️ WARNING: ADMIN_PASSWORD is not set in environment variables! Using default fallback for development.');
  }

  const passwordToHash = rawPassword || 'AudioFlowAdmin2026!';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(passwordToHash, saltRounds);

  adminUser = {
    email,
    passwordHash,
    role: 'admin',
    initializedAt: new Date().toISOString()
  };

  console.log(`🔐 Admin account initialized for [${email}] (bcrypt hash secured).`);
}

/**
 * Verify admin credentials securely against bcrypt hash.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object|null>} Returns sanitized admin object if valid, null otherwise
 */
async function verifyCredentials(email, password) {
  if (!adminUser) {
    await initAdmin();
  }

  if (!email || !password) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== adminUser.email) {
    // Constant-time dummy comparison to prevent timing attacks
    await bcrypt.compare(password, '$2a$10$dummyHashToPreventTimingAttacks12345678901234567890123456');
    return null;
  }

  const isMatch = await bcrypt.compare(password, adminUser.passwordHash);
  if (!isMatch) {
    return null;
  }

  return {
    email: adminUser.email,
    role: adminUser.role
  };
}

/**
 * Change admin password after verifying the existing password.
 * @param {string} oldPassword 
 * @param {string} newPassword 
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function changePassword(oldPassword, newPassword) {
  if (!adminUser) {
    await initAdmin();
  }

  if (!oldPassword || !newPassword) {
    return { success: false, message: 'Both current password and new password are required.' };
  }

  if (String(newPassword).length < 8) {
    return { success: false, message: 'New password must be at least 8 characters long.' };
  }

  const isMatch = await bcrypt.compare(oldPassword, adminUser.passwordHash);
  if (!isMatch) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  const saltRounds = 10;
  const newHash = await bcrypt.hash(newPassword, saltRounds);
  adminUser.passwordHash = newHash;

  console.log('🔐 Admin password updated and secured with bcrypt.');
  return { success: true, message: 'Password updated successfully.' };
}

/**
 * Check if the admin system is initialized
 */
function isInitialized() {
  return adminUser !== null;
}

module.exports = {
  initAdmin,
  verifyCredentials,
  changePassword,
  isInitialized
};

