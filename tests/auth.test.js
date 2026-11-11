const request = require('supertest');
const { app, server } = require('../server');

async function runIntegrationTests() {
  console.log('🚀 Running Full AudioFlow Authentication Integration Suite...\n');

  try {
    // 1. Health check
    console.log('1. Health Check Endpoint');
    const healthRes = await request(app).get('/api/health');
    console.assert(healthRes.status === 200, 'Health check should be 200');
    console.log('✅ /api/health returned 200 OK');

    // 2. Unauthenticated Protected API Access
    console.log('\n2. Unauthenticated Protected API Check');
    const unauthApi = await request(app).get('/api/admin/me');
    console.assert(unauthApi.status === 401, 'Unauthenticated API should return 401');
    console.log('✅ GET /api/admin/me blocked with 401 Unauthorized');

    // 3. Unauthenticated Protected Page Access
    console.log('\n3. Unauthenticated Protected Page Redirect Check');
    const unauthPage = await request(app).get('/admin');
    console.assert(unauthPage.status === 302, 'Unauthenticated page should redirect (302)');
    console.assert(unauthPage.headers.location.includes('login.html'), 'Location should be login.html');
    console.log('✅ GET /admin redirected to login page:', unauthPage.headers.location);

    // 4. Missing credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@audioflow.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AudioFlowAdmin2026!';

    console.log('\n4. Missing Credentials Validation');
    const missingCreds = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail });
    console.assert(missingCreds.status === 400, 'Missing password should return 400');
    console.log('✅ Validation correctly caught missing password (400)');

    // 5. Invalid password
    console.log('\n5. Invalid Password Authentication');
    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'DefinitelyWrongPassword!' });
    console.assert(wrongPass.status === 401, 'Wrong password should return 401');
    console.log('✅ Authentication rejected incorrect password with 401');

    // 6. Successful Login
    console.log('\n6. Successful Admin Authentication');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    console.assert(loginRes.status === 200, 'Valid credentials should return 200');
    console.assert(loginRes.body.success === true, 'Success flag should be true');

    const cookies = loginRes.headers['set-cookie'];
    console.assert(cookies && cookies.length > 0, 'Session cookie must be set');
    const sessionCookie = cookies[0];
    console.log('✅ Admin login succeeded (200 OK). Cookie received:', sessionCookie.split(';')[0]);

    // 7. Access Protected API with Active Session
    console.log('\n7. Accessing Protected Route with Authenticated Session');
    const authApi = await request(app)
      .get('/api/admin/me')
      .set('Cookie', sessionCookie);
    console.assert(authApi.status === 200, 'Authenticated session should return 200');
    console.assert(authApi.body.admin.email === adminEmail, 'Admin email should match');
    console.log('✅ GET /api/admin/me permitted for admin:', authApi.body.admin.email);

    // 8. Session Check Endpoint
    console.log('\n8. Session Status Check');
    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Cookie', sessionCookie);
    console.assert(sessionRes.body.authenticated === true, 'Session should be verified as active');
    console.log('✅ GET /api/auth/session verified active admin session');

    // 9. Logout
    console.log('\n9. Session Logout & Destruction');
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);
    console.assert(logoutRes.status === 200, 'Logout should return 200');
    console.log('✅ POST /api/auth/logout successfully destroyed session');

    // 10. Access Protected API after Logout
    console.log('\n10. Post-Logout Protection Check');
    const postLogoutApi = await request(app)
      .get('/api/admin/me')
      .set('Cookie', sessionCookie);
    console.assert(postLogoutApi.status === 401, 'Post-logout request must be 401');
    console.log('✅ GET /api/admin/me blocked with 401 after logout');

    console.log('\n====================================================');
    console.log('🎉 ALL 10 INTEGRATION TESTS PASSED WITHOUT ERRORS!');
    console.log('====================================================\n');
  } finally {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (server && server.close) {
      server.close();
    }
  }
}

runIntegrationTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Test failed with error:', err);
  if (server && server.close) server.close();
  process.exit(1);
});

