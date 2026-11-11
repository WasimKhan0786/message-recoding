/**
 * AudioFlow - Core Listening, Understanding & Response System Verification Test
 * Tests all 12 core requirements end-to-end against live backend logic & MongoDB.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const dashboardService = require('../src/services/dashboardService');
const Audio = require('../src/models/Audio');
const SharedLink = require('../src/models/SharedLink');
const ListenerResponse = require('../src/models/ListenerResponse');
const ListeningProgress = require('../src/models/ListeningProgress');
const WelcomeSettings = require('../src/models/WelcomeSettings');

let exitCode = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    exitCode = 1;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   AudioFlow Core System End-to-End Verification');
  console.log('======================================================\n');

  try {
    // 1. Connect MongoDB and wait for initial sync
    while (mongoose.connection.readyState !== 1) {
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 400));
    await dashboardService.hydrateFromDB();

    // Setup Test Audios: Part 1, Part 2, Part 3
    const audios = dashboardService.getSortedAudios();
    console.log(`Found ${audios.length} existing audio track(s).`);

    let audio1 = audios[0];
    let audio2 = audios[1];

    if (!audio1 || !audio2) {
      console.log('Creating sample audio parts for sequence test...');
      audio1 = await dashboardService.addAudio({
        title: 'Core Message Part 1: The Foundations',
        fileName: 'part1_foundation.mp3',
        s3Key: 'test/part1_foundation.mp3',
        duration: '02:00',
        format: 'MP3 128k',
        fileSize: '1.9 MB',
        sequenceOrder: 1,
        partNumber: 1,
        understandingQuestion: 'What did you understand from this recording?'
      });

      audio2 = await dashboardService.addAudio({
        title: 'Core Message Part 2: Advanced Perspectives',
        fileName: 'part2_advanced.mp3',
        s3Key: 'test/part2_advanced.mp3',
        duration: '03:15',
        format: 'MP3 128k',
        fileSize: '3.1 MB',
        sequenceOrder: 2,
        partNumber: 2,
        understandingQuestion: 'What did you understand from this recording?'
      });
    }

    // Create Shared Link for Part 1
    const testSlug = `core-test-${Date.now().toString(36)}`;
    const link = await dashboardService.createSharedLink({
      audioId: audio1.id,
      slug: testSlug,
      recipientName: 'Sarah Jenkins',
      recipientEmail: 'sarah.jenkins@example.com',
      expiresIn: 'permanent'
    });
    console.log(`Created test link: slug=${link.slug}`);

    const testSessionId = `test-sess-${Date.now()}`;

    // TEST 1: Initial Sequence State (Part 1 unlocked, Part 2 locked)
    console.log('\n--- Test 1: Sequential Audio Initial Lock State ---');
    const seqInitial = dashboardService.getAudioSequence(testSessionId);
    assert(seqInitial.length >= 2, 'Sequence contains at least 2 parts');
    const part1 = seqInitial.find(p => p.id === audio1.id);
    const part2 = seqInitial.find(p => p.id === audio2.id);
    assert(part1 && part1.isUnlocked === true, 'Part 1 is initially UNLOCKED');
    assert(part2 && part2.isUnlocked === false, 'Part 2 is initially LOCKED');
    assert(dashboardService.isAudioUnlocked(audio1.id, testSessionId) === true, 'Part 1 is unlocked in isAudioUnlocked check');
    assert(dashboardService.isAudioUnlocked(audio2.id, testSessionId) === false, 'Part 2 is locked in isAudioUnlocked check');

    // TEST 2: Playback Speed Validation (Max 2.0x, reject > 2.0x)
    console.log('\n--- Test 2: Playback Speed Controls (0.5x, 1x, 1.5x, 2x, reject > 2.0x) ---');
    let speedOk = true;
    try {
      dashboardService.recordListeningProgress({
        audioId: audio1.id,
        linkSlug: link.slug,
        sessionId: testSessionId,
        currentTime: 5,
        durationSeconds: 120,
        playbackSpeed: 1.5
      });
    } catch (e) {
      speedOk = false;
    }
    assert(speedOk, 'Speed 1.5x accepted without error');

    let speedOverRejected = false;
    try {
      dashboardService.recordListeningProgress({
        audioId: audio1.id,
        linkSlug: link.slug,
        sessionId: testSessionId,
        currentTime: 10,
        durationSeconds: 120,
        playbackSpeed: 2.5 // > 2.0 MUST be rejected
      });
    } catch (err) {
      speedOverRejected = err.message.includes('Maximum allowable playback speed is 2x');
    }
    assert(speedOverRejected, 'Speed 2.5x strictly REJECTED by backend (> 2.0x limit)');

    // TEST 3: Anti-Seeking Detection (Fast-forward to end does NOT verify completion)
    console.log('\n--- Test 3: Anti-Seeking Verification ---');
    const seekSess = `seek-sess-${Date.now()}`;
    // User suddenly jumps to 118 out of 120 seconds in 1 call:
    const seekProg = dashboardService.recordListeningProgress({
      audioId: audio1.id,
      linkSlug: link.slug,
      sessionId: seekSess,
      currentTime: 118,
      durationSeconds: 120,
      playbackSpeed: 1.0
    });
    assert(seekProg.playbackCompleted === false, 'Seeking to 118s directly does NOT mark playbackCompleted');
    assert(dashboardService.isPlaybackVerified(audio1.id, seekSess) === false, 'isPlaybackVerified returns false for jump-to-end');

    // TEST 4: Submission Rejection when Playback NOT Verified
    console.log('\n--- Test 4: Prevent Response Submission Before Playback Completion ---');
    let submissionBlocked = false;
    try {
      await dashboardService.saveListenerResponse({
        audioId: audio1.id,
        linkSlug: link.slug,
        sessionId: seekSess,
        responseText: 'I skipped to the end and tried to submit.',
        listenerName: 'Cheater'
      });
    } catch (err) {
      submissionBlocked = err.message.includes('Playback verification incomplete');
    }
    assert(submissionBlocked, 'Response submission BLOCKED with error when audio not verified complete');

    // TEST 5: Authentic Playback Progression Verifies Completion
    console.log('\n--- Test 5: Continuous Playback Verification ---');
    const legitSess = `legit-sess-${Date.now()}`;
    const audioDur = 100;
    // Simulate natural heartbeats with authentic wallClockElapsed
    for (let t = 0; t <= 98; t += 10) {
      dashboardService.recordListeningProgress({
        audioId: audio1.id,
        linkSlug: link.slug,
        sessionId: legitSess,
        currentTime: t,
        durationSeconds: audioDur,
        playbackSpeed: 1.0,
        wallClockElapsed: 10
      });
    }
    // Final progress near end:
    const verifiedProg = dashboardService.recordListeningProgress({
      audioId: audio1.id,
      linkSlug: link.slug,
      sessionId: legitSess,
      currentTime: 98,
      durationSeconds: audioDur,
      playbackSpeed: 1.0,
      wallClockElapsed: 5
    });
    assert(verifiedProg.playbackCompleted === true, 'Continuous playback reaches verified completion');
    assert(dashboardService.isPlaybackVerified(audio1.id, legitSess) === true, 'isPlaybackVerified returns TRUE for authentic listening');

    // TEST 6: Response Submission & MongoDB Persistence
    console.log('\n--- Test 6: Response Submission & MongoDB Storage ---');
    const responseResult = await dashboardService.saveListenerResponse({
      audioId: audio1.id,
      linkSlug: link.slug,
      sessionId: legitSess,
      responseText: 'The message emphasized that authentic understanding requires attentiveness and reflection in one’s own words.',
      listenerName: 'Sarah Jenkins'
    });
    assert(responseResult && responseResult.response, 'Response saved successfully');
    assert(responseResult.response.partNumber === 1, 'Response assigned Part Number 1');
    assert(responseResult.response.isRead === false, 'Response saved with isRead = false');

    // Check DB record
    const dbRecord = await ListenerResponse.findOne({ sessionId: legitSess, audioId: audio1.id });
    assert(dbRecord !== null, 'Response found persistently in MongoDB ListenerResponse collection');

    // TEST 7: Duplicate Submission Updates Record Without Error
    console.log('\n--- Test 7: Duplicate / Updated Submission Handling ---');
    const updatedResult = await dashboardService.saveListenerResponse({
      audioId: audio1.id,
      linkSlug: link.slug,
      sessionId: legitSess,
      responseText: 'Updated reflection: Listening attentively without rushing reveals deeper perspective.',
      listenerName: 'Sarah Jenkins'
    });
    assert(updatedResult.response.id === responseResult.response.id, 'Duplicate submission updates existing record (no duplicate IDs)');
    const countRecords = await ListenerResponse.countDocuments({ sessionId: legitSess, audioId: audio1.id });
    assert(countRecords === 1, 'Exactly 1 response record exists in MongoDB for this session');

    // TEST 8: Next Part Unlocks ONLY After Verified Playback + Response Submitted
    console.log('\n--- Test 8: Dynamic Next Part Unlock Logic ---');
    const seqAfterResponse = dashboardService.getAudioSequence(legitSess);
    const p1After = seqAfterResponse.find(p => p.id === audio1.id);
    const p2After = seqAfterResponse.find(p => p.id === audio2.id);
    assert(p1After.hasResponse === true, 'Part 1 hasResponse is TRUE');
    assert(p1After.playbackCompleted === true, 'Part 1 playbackCompleted is TRUE');
    assert(p2After && p2After.isUnlocked === true, 'Part 2 is now UNLOCKED dynamically!');
    assert(dashboardService.isAudioUnlocked(audio2.id, legitSess) === true, 'isAudioUnlocked returns TRUE for Part 2');

    // TEST 9: Admin Responses Management & Unread Notifications
    console.log('\n--- Test 9: Admin Response Management & Unread Counters ---');
    const adminResponses = dashboardService.getAllListenerResponses();
    const foundAdminResp = adminResponses.find(r => r.sessionId === legitSess);
    assert(foundAdminResp !== undefined, 'Admin sees submitted response');
    assert(foundAdminResp.partNumber === 1, 'Admin sees Part 1 displayed');
    assert(foundAdminResp.isRead === false, 'Admin sees NEW unread indicator');
    assert(foundAdminResp.playbackCompleted === true, 'Admin sees verified playback completion');

    const statsBefore = dashboardService.getOverviewStats();
    assert(statsBefore.unreadResponses >= 1, `Stats reports ${statsBefore.unreadResponses} unread response(s)`);

    // Admin opens and reviews response
    const marked = dashboardService.markResponseAsRead(foundAdminResp.id);
    assert(marked.isRead === true, 'markResponseAsRead marks response as read');

    const statsAfter = dashboardService.getOverviewStats();
    assert(statsAfter.unreadResponses === statsBefore.unreadResponses - 1, 'Unread responses count decrements after review');

    // TEST 10: Progress Resumption & Completed Replayability
    console.log('\n--- Test 10: Progress Resumption & Replay Completed Tracks ---');
    const saved = dashboardService.getPlaybackProgress(audio1.id, legitSess);
    assert(saved && saved.playbackCompleted === true, 'Progress is saved and available for session reload');
    // Verify Part 1 can be replayed without locking Part 2
    assert(dashboardService.isAudioUnlocked(audio1.id, legitSess) === true, 'Completed Part 1 can be replayed anytime');
    assert(dashboardService.isAudioUnlocked(audio2.id, legitSess) === true, 'Part 2 remains unlocked while Part 1 is replayed');

    // TEST 11: Homepage UI & Public Sequential Flow Verification
    console.log('\n--- Test 11: Homepage UI & Public Sequential Listening Flow ---');
    const homeAgent = request.agent(app);

    // 11a. Homepage HTML served with personal welcome and response form
    const homeHtmlRes = await homeAgent.get('/');
    assert(homeHtmlRes.status === 200, 'Homepage GET / returns 200 OK');
    assert(homeHtmlRes.text.includes('id="welcomeIntroCard"'), 'Homepage contains personal welcome intro card');
    assert(homeHtmlRes.text.includes('id="understandingSection"'), 'Homepage contains understanding & reflection form');
    assert(homeHtmlRes.text.includes('id="speedPillsGroup"'), 'Homepage contains dedicated speed pills selector');
    assert(homeHtmlRes.text.includes('id="sequentialJourneyCard"'), 'Homepage contains sequential audio journey card');

    // 11b. Public Sequence API
    const seqApiRes = await homeAgent.get('/api/public/sequence');
    assert(seqApiRes.status === 200, 'Public Sequence API returns 200 OK');
    assert(seqApiRes.body.sequence && seqApiRes.body.sequence.length >= 2, 'Public Sequence contains parts');
    assert(seqApiRes.body.welcomeSettings !== undefined, 'Welcome settings returned dynamically');

    // 11c. Public Progress Telemetry on Homepage
    const homeTrack = seqApiRes.body.sequence[0];
    const trackDur = 120;
    const homeProgRes = await homeAgent
      .post('/api/public/progress')
      .send({
        audioId: homeTrack.id,
        currentTime: trackDur - 4,
        durationSeconds: trackDur,
        playbackSpeed: 1.0,
        wallClockElapsed: trackDur - 4
      });
    assert(homeProgRes.status === 200, 'Public progress returns 200');
    assert(homeProgRes.body.playbackCompleted === true, 'Public playback verified completed on homepage');

    // 11d. Public Response Submission on Homepage
    const homeRespRes = await homeAgent
      .post('/api/public/response')
      .send({
        audioId: homeTrack.id,
        responseText: 'This recording made me understand the importance of attentive listening and personal reflection.'
      });
    assert(homeRespRes.status === 201, 'Public response submitted successfully with 201 Created');
    assert(homeRespRes.body.sequence[1].isUnlocked === true, 'Part 2 unlocks on homepage after submission');

    console.log('\n======================================================');
    if (exitCode === 0) {
      console.log('   ALL 11 CORE & HOMEPAGE VERIFICATION TESTS PASSED (100%)!');
    } else {
      console.log('   SOME TESTS FAILED');
    }
    console.log('======================================================\n');

  } catch (err) {
    console.error('Fatal error during test run:', err);
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

runTests();
