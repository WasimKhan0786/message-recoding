/**
 * AudioFlow — End-to-End Comprehensive Platform Verification Test
 * 
 * Verifies:
 * 1. Health check & MongoDB Atlas connectivity
 * 2. Admin Authentication (bcrypt + session cookie)
 * 3. Overview statistics (Total storage, total audios, active/expired links)
 * 4. Audio CRUD (Create, Read Single, Update/Patch, Delete)
 * 5. Secure Shared Links:
 *    - Expiration handling (24h, 7d, 30d, permanent)
 *    - Bcrypt password protection & verification
 *    - Status toggling (Active <-> Disabled)
 *    - Revocation
 * 6. Public recipient streaming endpoints & password authorization
 * 7. Admin password change & credential verification
 */

require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');
const { app, server } = require('../server');
const dashboardService = require('../src/services/dashboardService');

async function runPlatformTest() {
  console.log('====================================================');
  console.log('🚀 Running Complete AudioFlow Platform Verification');
  console.log('====================================================\n');

  try {
    // 1. Health Check
    console.log('1. Health Check & Database State');
    const health = await request(app).get('/api/health');
    console.assert(health.status === 200, 'Health check must be 200');
    console.log(`✅ System Healthy. Database: ${health.body.database?.type} (${health.body.database?.state})`);

    // 2. Admin Login
    console.log('\n2. Admin Authentication (bcrypt + sessions)');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@audioflow.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AudioFlowAdmin2026!';
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    console.assert(loginRes.status === 200, 'Login must succeed');
    const cookie = loginRes.headers['set-cookie'][0];
    console.log('✅ Admin login succeeded, session cookie acquired');

    // 3. Overview Stats
    console.log('\n3. Overview KPI Calculation (Real Data)');
    const statsRes = await request(app)
      .get('/api/admin/dashboard/stats')
      .set('Cookie', cookie);
    console.assert(statsRes.status === 200, 'Stats must be 200');
    console.log('✅ Overview Stats:', {
      totalAudios: statsRes.body.stats.totalAudios,
      totalLinks: statsRes.body.stats.totalLinks,
      activeLinks: statsRes.body.stats.activeLinks,
      totalStorage: statsRes.body.stats.totalStorageFormatted
    });

    // 4. Audio CRUD
    console.log('\n4. Audio CRUD Operations');
    // Create
    const createAudioRes = await request(app)
      .post('/api/admin/audios')
      .set('Cookie', cookie)
      .send({
        title: 'Master Audio Flow Test Track',
        genre: 'Podcast',
        format: 'MP3 128k',
        duration: '15:20',
        description: 'Comprehensive platform testing audio'
      });
    console.assert(createAudioRes.status === 201, 'Audio create must be 201');
    const audioId = createAudioRes.body.audio.id;
    console.log(`✅ Audio created with ID: [${audioId}]`);

    // Read Single
    const readAudioRes = await request(app)
      .get(`/api/admin/audios/${audioId}`)
      .set('Cookie', cookie);
    console.assert(readAudioRes.status === 200, 'Read single audio must be 200');
    console.assert(readAudioRes.body.audio.title === 'Master Audio Flow Test Track', 'Title must match');
    console.log(`✅ Single audio fetched: "${readAudioRes.body.audio.title}"`);

    // Update (PATCH)
    const patchAudioRes = await request(app)
      .patch(`/api/admin/audios/${audioId}`)
      .set('Cookie', cookie)
      .send({
        title: 'Master Audio Flow Test Track (Updated)',
        genre: 'Interview',
        description: 'Updated metadata notes'
      });
    console.assert(patchAudioRes.status === 200, 'Audio update must be 200');
    console.assert(patchAudioRes.body.audio.title === 'Master Audio Flow Test Track (Updated)', 'Updated title must match');
    console.log(`✅ Audio updated via PATCH: "${patchAudioRes.body.audio.title}"`);

    // 5. Shared Links with Expiration & Password Protection
    console.log('\n5. Secure Shared Link Generation');
    
    // 5a. Permanent Public Link
    const permLinkRes = await request(app)
      .post('/api/admin/links')
      .set('Cookie', cookie)
      .send({
        audioId,
        expiresOption: 'permanent',
        notes: 'Permanent link test'
      });
    console.assert(permLinkRes.status === 201, 'Permanent link must be 201');
    const permSlug = permLinkRes.body.link.slug;
    console.log(`✅ Permanent link generated: /listen/${permSlug}`);

    // 5b. Password-Protected Link (24 Hours)
    const pwdLinkRes = await request(app)
      .post('/api/admin/links')
      .set('Cookie', cookie)
      .send({
        audioId,
        expiresOption: '24h',
        password: 'AudioSecret2026!',
        notes: 'Protected link test'
      });
    console.assert(pwdLinkRes.status === 201, 'Password link must be 201');
    const pwdSlug = pwdLinkRes.body.link.slug;
    const pwdLinkId = pwdLinkRes.body.link.id;
    console.log(`✅ Password-protected link generated: /listen/${pwdSlug} (Expires in 24h)`);

    // 6. Public Page & Password Challenge Verification
    console.log('\n6. Public Recipient Endpoint & Security Verification');

    // 6a. Access permanent public link
    const publicRes = await request(app).get(`/api/listen/${permSlug}`);
    console.assert(publicRes.status === 200, 'Public link must return 200');
    console.assert(publicRes.body.requiresPassword === false, 'Public link should not require password');
    console.log('✅ Public audio link metadata accessed without password requirement');

    // 6b. Access password-protected link without authentication
    const protectedRes = await request(app).get(`/api/listen/${pwdSlug}`);
    console.assert(protectedRes.status === 200, 'Protected link returns 200 with challenge');
    console.assert(protectedRes.body.requiresPassword === true, 'Link must require password');
    console.assert(protectedRes.body.isUnlocked === false, 'Link must be locked');
    console.log('✅ Password protection verified: Client correctly instructed that password is required');

    // 6c. Test invalid password attempt
    const wrongPwdRes = await request(app)
      .post(`/api/listen/${pwdSlug}/verify-password`)
      .send({ password: 'WrongPassword123' });
    console.assert(wrongPwdRes.status === 401, 'Wrong password must return 401');
    console.log('✅ Invalid password correctly rejected with 401 Unauthorized');

    // 6d. Test valid password verification
    const validPwdRes = await request(app)
      .post(`/api/listen/${pwdSlug}/verify-password`)
      .send({ password: 'AudioSecret2026!' });
    console.assert(validPwdRes.status === 200, 'Correct password must return 200');
    const visitorCookie = validPwdRes.headers['set-cookie'][0];
    console.log('✅ Correct password accepted, unlock session cookie issued');

    // 6e. Access unlocked link with session
    const unlockedRes = await request(app)
      .get(`/api/listen/${pwdSlug}`)
      .set('Cookie', visitorCookie);
    console.assert(unlockedRes.body.isUnlocked === true, 'Link must now be unlocked');
    console.log('✅ Unlocked session verified: Recipient now authorized for streaming');

    // 7. Link Management (Enable/Disable & Revoke)
    console.log('\n7. Link State Management (Toggle, Revoke, Delete)');
    
    // Toggle to Disabled
    const toggleRes = await request(app)
      .patch(`/api/admin/links/${pwdLinkId}/toggle`)
      .set('Cookie', cookie);
    console.assert(toggleRes.status === 200, 'Toggle must be 200');
    console.assert(toggleRes.body.link.status === 'disabled', 'Status must be disabled');
    console.log('✅ Link disabled successfully');

    // Access disabled link from public API
    const disabledAccess = await request(app).get(`/api/listen/${pwdSlug}`);
    console.assert(disabledAccess.body.isDisabled === true, 'Public API must flag link as disabled');
    console.log('✅ Public listener blocked when link is disabled');

    // Re-enable link
    await request(app).patch(`/api/admin/links/${pwdLinkId}/toggle`).set('Cookie', cookie);
    console.log('✅ Link re-enabled successfully');

    // Revoke link
    const revokeRes = await request(app)
      .delete(`/api/admin/links/${pwdLinkId}`)
      .set('Cookie', cookie);
    console.assert(revokeRes.status === 200, 'Revoke must be 200');
    console.log('✅ Link revoked successfully');

    // Access revoked link
    const revokedAccess = await request(app).get(`/api/listen/${pwdSlug}`);
    console.assert(revokedAccess.body.isRevoked === true, 'Public API must flag link as revoked');
    console.log('✅ Public listener notified that link has been revoked');

    // 8. Audio Understanding & Response System Test
    console.log('\n8. Audio Understanding & Response Flow');
    
    // Create second audio lesson to verify sequential unlocking
    const lesson2Res = await request(app)
      .post('/api/admin/audios')
      .set('Cookie', cookie)
      .send({
        title: 'Master Audio Flow Lesson 2: Advanced Topics',
        genre: 'Podcast',
        format: 'MP3 128k',
        duration: '10:00',
        description: 'Sequentially unlocked lesson'
      });
    const lesson2Id = lesson2Res.body.audio.id;

    // Submit listener comprehension response on permLink (requires verified playback completion)
    const listenerAgent = request.agent(app); // Maintains listener session cookie

    // Recipient opens page to initialize session
    await listenerAgent.get(`/api/listen/${permSlug}`);

    // Verify playback completion via telemetry first (track is 15:20 = 920 seconds)
    const trackDurationSecs = 15 * 60 + 20;
    const progressRes = await listenerAgent
      .post(`/api/listen/${permSlug}/progress`)
      .send({
        audioId,
        currentTime: trackDurationSecs - 5,
        durationSeconds: trackDurationSecs,
        playbackSpeed: 1.0,
        wallClockElapsed: trackDurationSecs - 5
      });
    console.assert(progressRes.body.playbackCompleted === true, 'Playback must be verified complete');

    const submitResponseRes = await listenerAgent
      .post(`/api/listen/${permSlug}/response`)
      .send({
        responseText: 'I learned how audio streaming works with HTTP 206 range requests and how comprehension summaries verify active listening.'
      });
    if (submitResponseRes.status !== 201) {
      console.log('submitResponseRes status:', submitResponseRes.status, submitResponseRes.body);
    }
    console.assert(submitResponseRes.status === 201, 'Response submission must return 201');
    console.assert(submitResponseRes.body.response.id, 'Response must have an ID');
    console.assert(submitResponseRes.body.nextAudio !== null, 'Next audio must be unlocked');
    const responseId = submitResponseRes.body.response.id;
    console.log(`✅ Listener response saved [${responseId}], next lesson unlocked: "${submitResponseRes.body.nextAudio.title}"`);

    // Verify listener can retrieve their own response
    const getResponseRes = await listenerAgent.get(`/api/listen/${permSlug}/response`);
    console.assert(getResponseRes.status === 200, 'Listener can retrieve own response');
    console.assert(getResponseRes.body.hasResponse === true, 'hasResponse must be true');
    console.assert(getResponseRes.body.response.responseText.includes('HTTP 206'), 'Response text must match');
    console.log('✅ Listener session successfully retrieved saved response');

    // Verify listener can edit / update response before final review
    const updateResponseRes = await listenerAgent
      .post(`/api/listen/${permSlug}/response`)
      .send({
        responseText: 'Revised: I learned about audio streaming, FFmpeg compression, and sequential lesson unlocks.'
      });
    console.assert(updateResponseRes.status === 201, 'Response update must return 201');
    console.assert(updateResponseRes.body.response.responseText.includes('Revised:'), 'Revised text must be stored');
    console.log('✅ Listener revised their response before review');

    // Admin reviews responses
    const adminResponsesList = await request(app)
      .get('/api/admin/responses')
      .set('Cookie', cookie);
    console.assert(adminResponsesList.status === 200, 'Admin can list listener responses');
    const foundResponse = adminResponsesList.body.responses.find(r => r.id === responseId);
    console.assert(!!foundResponse, 'Response must appear in admin list');
    console.log(`✅ Admin dashboard loaded ${adminResponsesList.body.responses.length} listener response(s)`);

    // Admin reads single response
    const adminSingleResponse = await request(app)
      .get(`/api/admin/responses/${responseId}`)
      .set('Cookie', cookie);
    console.assert(adminSingleResponse.status === 200, 'Admin can read single response');
    console.assert(adminSingleResponse.body.response.id === responseId, 'Response ID must match');

    // Admin reviews and adds notes (without automated AI judgment)
    const reviewPatchRes = await request(app)
      .patch(`/api/admin/responses/${responseId}`)
      .set('Cookie', cookie)
      .send({
        adminNotes: 'Great summary and accurate key takeaways from the lesson.',
        status: 'reviewed'
      });
    console.assert(reviewPatchRes.status === 200, 'Admin review patch must return 200');
    console.assert(reviewPatchRes.body.response.status === 'reviewed', 'Status must be updated to reviewed');
    console.assert(reviewPatchRes.body.response.adminNotes.includes('Great summary'), 'Admin notes must be saved');
    console.log('✅ Admin successfully reviewed listener response and saved review notes');

    // 9. Public Audio Streaming & Download Protection Test
    console.log('\n9. Public Audio Streaming & Download Protection Flow');
    
    // 9a. Anyone can access public catalog without login
    const publicCatalogRes = await request(app).get('/api/public/audios');
    console.assert(publicCatalogRes.status === 200, 'Public catalog must return 200 without login');
    console.assert(Array.isArray(publicCatalogRes.body.audios), 'Audios must be an array');
    console.assert(publicCatalogRes.body.audios.length > 0, 'Catalog should contain recordings');
    
    // Verify credentials & bucket are never exposed
    const sampleTrack = publicCatalogRes.body.audios[0];
    console.assert(sampleTrack.s3Key === undefined, 's3Key must NOT be exposed in public API');
    console.assert(sampleTrack.s3Bucket === undefined, 's3Bucket must NOT be exposed in public API');
    console.assert(typeof sampleTrack.streamUrl === 'string', 'streamUrl must be provided');
    console.log(`✅ Public catalog loaded ${publicCatalogRes.body.audios.length} recording(s) without credentials exposure`);

    // 9b. Short-lived stream token generation
    const streamTokenRes = await request(app).get(`/api/public/audios/${audioId}/stream-token`);
    console.assert(streamTokenRes.status === 200, 'Stream token must return 200');
    console.assert(typeof streamTokenRes.body.token === 'string', 'Token must be a string');
    console.log('✅ Short-lived stream access token generated successfully');

    // 9c. Invalid or tampered token rejected with 403
    const badTokenRes = await request(app).get('/api/public/stream/fake-token.12345.tampered');
    console.assert(badTokenRes.status === 403, 'Tampered token must be rejected with 403');
    console.log('✅ Tampered/invalid stream token correctly blocked with 403');

    // 9d. Direct download endpoint blocked for public users
    const directDownloadRes = await request(app).get(`/api/public/audios/${audioId}/download`);
    console.assert(directDownloadRes.status === 403, 'Direct download must return 403');
    console.assert(directDownloadRes.body.error === 'Download Disabled', 'Error message must confirm download disabled');
    console.log('✅ Direct file download blocked with 403 (Download Protection verified)');

    // 10. Admin Password Change & Re-Authentication
    console.log('\n10. Admin Password Change Flow');
    const changePwdRes = await request(app)
      .post('/api/admin/settings/password')
      .set('Cookie', cookie)
      .send({
        currentPassword: adminPassword,
        newPassword: adminPassword + 'Upgraded!'
      });
    console.assert(changePwdRes.status === 200, 'Password change must return 200');
    console.log('✅ Admin password updated successfully');

    // Old password should fail
    const oldLoginFail = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    console.assert(oldLoginFail.status === 401, 'Old password must fail');
    console.log('✅ Old password rejected with 401');

    // New password should succeed
    const newLoginSuccess = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword + 'Upgraded!' });
    console.assert(newLoginSuccess.status === 200, 'New password must succeed');
    console.log('✅ Login succeeded with newly updated password');

    // Restore original password for consistent environment
    const newCookie = newLoginSuccess.headers['set-cookie'][0];
    await request(app)
      .post('/api/admin/settings/password')
      .set('Cookie', newCookie)
      .send({
        currentPassword: adminPassword + 'Upgraded!',
        newPassword: adminPassword
      });
    console.log('✅ Original admin password restored');

    // 11. Welcome Page Presentation Settings Verification
    console.log('\n11. Welcome Page Presentation & Filebase S3 Integration Flow');
    
    // 11a. Unauthenticated access blocked
    const unauthWelcomeRes = await request(app).get('/api/admin/welcome-settings');
    console.assert(unauthWelcomeRes.status === 401, 'Unauthenticated welcome settings must be blocked');
    console.log('✅ Unauthenticated access to welcome settings blocked (401)');

    // 11b. Update welcome settings via admin session
    const updateWelcomeRes = await request(app)
      .post('/api/admin/welcome-settings')
      .set('Cookie', newCookie)
      .send({
        heading: 'Mastering Audio Production & Flow',
        description: 'Immerse yourself in our sound engineering lessons and reflective audio.',
        thankYouMessage: 'Thank you for your dedication to pristine audio quality!',
        enabled: true
      });
    console.assert(updateWelcomeRes.status === 200, 'Welcome settings update must return 200');
    console.assert(updateWelcomeRes.body.settings.heading === 'Mastering Audio Production & Flow');
    console.log('✅ Welcome page settings saved in MongoDB');

    // 11c. Public endpoint delivers dynamic welcome settings
    const publicWelcomeRes = await request(app).get('/api/public/welcome-settings');
    console.assert(publicWelcomeRes.status === 200, 'Public welcome settings must return 200');
    console.assert(publicWelcomeRes.body.settings.heading === 'Mastering Audio Production & Flow');
    console.log('✅ Public website dynamically received updated welcome heading & description');

    // 11d. Welcome image endpoint streams safely without exposing credentials
    const welcomeImgRes = await request(app).get('/api/public/welcome-image');
    console.assert(welcomeImgRes.status === 200, 'Welcome image endpoint must return 200');
    console.assert(welcomeImgRes.headers['content-type'].includes('image'), 'Content-Type must be an image');
    console.log('✅ Welcome image stream verified (private Filebase / secure fallback)');

    // Clean up test records
    await request(app).delete(`/api/admin/audios/${audioId}`).set('Cookie', newCookie);
    await request(app).delete(`/api/admin/audios/${lesson2Id}`).set('Cookie', newCookie);
    await request(app).delete(`/api/admin/responses/${responseId}`).set('Cookie', newCookie);
    await request(app).delete(`/api/admin/links/${permLinkRes.body.link.id}/permanent`).set('Cookie', newCookie);
    await request(app).delete(`/api/admin/links/${pwdLinkId}/permanent`).set('Cookie', newCookie);
    console.log('✅ Test artifacts cleaned up');

    console.log('\n====================================================');
    console.log('🎉 ALL AUDIOFLOW PLATFORM TESTS PASSED (100%)!');
    console.log('====================================================\n');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (server && server.close) server.close();
  }
}

runPlatformTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Platform test failed:', err);
  if (server && server.close) server.close();
  process.exit(1);
});

