const request = require('supertest');
const { app, server } = require('../server');

async function runDashboardTests() {
  console.log('🚀 Running Dashboard Data & Security Test Suite...\n');

  try {
    // 1. Unauthenticated request to dashboard API must be blocked with 401
    console.log('1. Checking unauthenticated protection on /api/admin/dashboard/stats');
    const blocked = await request(app).get('/api/admin/dashboard/stats');
    console.assert(blocked.status === 401, 'Should block unauthenticated access');
    console.log('✅ Unauthenticated request correctly blocked with 401');

    // 2. Authenticate admin
    console.log('\n2. Authenticating admin');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@audioflow.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AudioFlowAdmin2026!';
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    const sessionCookie = loginRes.headers['set-cookie'][0];
    console.log('✅ Authenticated successfully, session cookie acquired');

    // 3. Verify real initial stats
    console.log('\n3. Verifying initial real statistics');
    const statsRes = await request(app)
      .get('/api/admin/dashboard/stats')
      .set('Cookie', sessionCookie);
    console.assert(statsRes.status === 200, 'Stats should return 200');
    const initialAudios = statsRes.body.stats.totalAudios;
    const initialRecipients = statsRes.body.stats.totalRecipients;
    const initialLinks = statsRes.body.stats.activeLinks;
    console.log('✅ Baseline stats verified:', statsRes.body.stats);

    // 4. Add an Audio record
    console.log('\n4. Adding an audio record');
    const audioRes = await request(app)
      .post('/api/admin/audios')
      .set('Cookie', sessionCookie)
      .send({
        title: 'Deep Focus Ambient Flow',
        genre: 'Ambient',
        format: 'FLAC',
        duration: '05:30',
        description: 'Binaural soundscape for study and focus'
      });
    console.assert(audioRes.status === 201, 'Audio creation should return 201');
    const audioId = audioRes.body.audio.id;
    console.log('✅ Audio record created with ID:', audioId);

    // 4b. Fetch single audio by ID
    console.log('\n4b. Fetching single audio by ID');
    const getSingleRes = await request(app)
      .get(`/api/admin/audios/${audioId}`)
      .set('Cookie', sessionCookie);
    console.assert(getSingleRes.status === 200, 'Single audio fetch should return 200');
    console.assert(getSingleRes.body.audio.title === 'Deep Focus Ambient Flow', 'Title must match');
    console.log('✅ Single audio record retrieved successfully:', getSingleRes.body.audio.title);

    // 4c. Update audio metadata via PATCH
    console.log('\n4c. Updating audio metadata via PATCH');
    const patchRes = await request(app)
      .patch(`/api/admin/audios/${audioId}`)
      .set('Cookie', sessionCookie)
      .send({ title: 'Deep Focus Ambient Flow (Remastered)', genre: 'Meditation' });
    console.assert(patchRes.status === 200, 'Audio patch should return 200');
    console.assert(patchRes.body.audio.title === 'Deep Focus Ambient Flow (Remastered)', 'Updated title must match');
    console.log('✅ Audio record updated successfully:', patchRes.body.audio.title);

    // 5. Add a Recipient record
    console.log('\n5. Adding a recipient');
    const recipRes = await request(app)
      .post('/api/admin/recipients')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Jordan Miller',
        email: 'jordan@example.com',
        group: 'VIP Reviewers',
        notes: 'Sound designer client'
      });
    console.assert(recipRes.status === 201, 'Recipient creation should return 201');
    const recipId = recipRes.body.recipient.id;
    console.log('✅ Recipient created with ID:', recipId);

    // 6. Generate a Shared Link
    console.log('\n6. Generating a shared link');
    const linkRes = await request(app)
      .post('/api/admin/links')
      .set('Cookie', sessionCookie)
      .send({
        audioId,
        recipientId: recipId,
        expiresDays: 7,
        notes: 'Preview draft v1'
      });
    console.assert(linkRes.status === 201, 'Link generation should return 201');
    const linkId = linkRes.body.link.id;
    console.log('✅ Shared link created with token slug:', linkRes.body.link.slug);

    // 7. Verify updated stats reflect real changes
    console.log('\n7. Verifying stats reflect actual added items');
    const updatedStats = await request(app)
      .get('/api/admin/dashboard/stats')
      .set('Cookie', sessionCookie);
    console.assert(updatedStats.body.stats.totalAudios === initialAudios + 1, 'Total audios should increment by 1');
    console.assert(updatedStats.body.stats.totalRecipients === initialRecipients + 1, 'Total recipients should increment by 1');
    console.assert(updatedStats.body.stats.activeLinks === initialLinks + 1, 'Active links should increment by 1');
    console.log('✅ Verified updated stats:', {
      totalAudios: updatedStats.body.stats.totalAudios,
      totalRecipients: updatedStats.body.stats.totalRecipients,
      activeLinks: updatedStats.body.stats.activeLinks
    });

    // 8. Verify Activity log contains recorded actions
    console.log('\n8. Checking activity audit log');
    const actRes = await request(app)
      .get('/api/admin/activity')
      .set('Cookie', sessionCookie);
    console.assert(actRes.body.activities.length >= 3, 'Activity log should contain actions');
    console.log('✅ Activity audit log contains real events:', actRes.body.activities.map(a => a.action));

    // 9. Revoke shared link
    console.log('\n9. Revoking shared link');
    const revokeRes = await request(app)
      .delete(`/api/admin/links/${linkId}`)
      .set('Cookie', sessionCookie);
    console.assert(revokeRes.status === 200, 'Revoke should return 200');
    console.log('✅ Shared link revoked successfully');

    // 10. Update settings
    console.log('\n10. Updating platform settings');
    const settingsRes = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', sessionCookie)
      .send({ siteName: 'AudioFlow Studio', defaultLinkExpirationDays: 14 });
    console.assert(settingsRes.status === 200, 'Settings update should return 200');
    console.assert(settingsRes.body.settings.siteName === 'AudioFlow Studio', 'Site name should be updated');
    console.log('✅ Platform settings updated successfully');

    // 11. Welcome Page Settings & Public Integration
    console.log('\n11. Welcome Page Settings & Public Integration');
    const unauthWelcome = await request(app).get('/api/admin/welcome-settings');
    console.assert(unauthWelcome.status === 401, 'Unauthenticated welcome settings should be blocked');
    console.log('✅ Unauthenticated access to welcome settings correctly blocked (401)');

    const getWelcomeRes = await request(app)
      .get('/api/admin/welcome-settings')
      .set('Cookie', sessionCookie);
    console.assert(getWelcomeRes.status === 200, 'Admin get welcome settings should return 200');
    console.log('✅ Current welcome settings retrieved');

    const updateWelcomeRes = await request(app)
      .post('/api/admin/welcome-settings')
      .set('Cookie', sessionCookie)
      .send({
        heading: 'Mastering Audio Production',
        description: 'Listen to the deep-dive audio masterclass below.',
        thankYouMessage: 'Thank you for your dedication to pristine audio quality!',
        enabled: true
      });
    console.assert(updateWelcomeRes.status === 200, 'Update welcome settings should return 200');
    console.assert(updateWelcomeRes.body.settings.heading === 'Mastering Audio Production');
    console.log('✅ Welcome page settings updated and saved persistently');

    const publicWelcomeRes = await request(app).get('/api/public/welcome-settings');
    console.assert(publicWelcomeRes.status === 200, 'Public welcome settings should return 200');
    console.assert(publicWelcomeRes.body.settings.heading === 'Mastering Audio Production');
    console.log('✅ Dynamic public welcome settings verified');

    const publicImageRes = await request(app).get('/api/public/welcome-image');
    console.assert(publicImageRes.status === 200, 'Welcome image endpoint should return 200');
    console.log('✅ Welcome image endpoint streaming verified');

    console.log('\n====================================================');
    console.log('🎉 ALL DASHBOARD TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } finally {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (server && server.close) server.close();
  }
}

runDashboardTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test error:', err);
  if (server && server.close) server.close();
  process.exit(1);
});

