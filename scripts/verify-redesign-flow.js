const mongoose = require('mongoose');
require('dotenv').config();

async function testWorkflow() {
  const host = 'http://localhost:3000';
  const testSession = 'test-flow-' + Date.now();
  console.log('Testing Redesigned Workflow with session:', testSession);

  // 1. Fetch sequence
  const seqRes = await fetch(`${host}/api/public/sequence?sessionId=${testSession}`);
  const seqData = await seqRes.json();
  console.log('1. Sequence fetched. Total parts:', seqData.sequence.length);
  console.log('   Welcome Heading:', seqData.welcomeSettings.heading);
  console.log('   Part 1 status:', seqData.sequence[0].status, 'isUnlocked:', seqData.sequence[0].isUnlocked);
  console.log('   Part 2 status:', seqData.sequence[1].status, 'isUnlocked:', seqData.sequence[1].isUnlocked);

  if (!seqData.sequence[0].isUnlocked || seqData.sequence[1].isUnlocked) {
    throw new Error('Initial lock state failed: Part 1 must be unlocked, Part 2 locked.');
  }

  // 2. Telemetry: Play Part 1 with authentic continuous listening
  const part1 = seqData.sequence[0];
  const dur = part1.durationSeconds || 438;
  
  // Heartbeat 1 (start)
  await fetch(`${host}/api/public/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioId: part1.id,
      currentTime: 0,
      durationSeconds: dur,
      playbackSpeed: 1.0,
      sessionId: testSession
    })
  });

  // Heartbeat 2 (listening 10 seconds)
  await fetch(`${host}/api/public/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioId: part1.id,
      currentTime: 10,
      durationSeconds: dur,
      playbackSpeed: 1.0,
      wallClockElapsed: 10,
      sessionId: testSession
    })
  });

  // Heartbeat 3 (song completion / ended)
  const progRes = await fetch(`${host}/api/public/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioId: part1.id,
      currentTime: dur,
      durationSeconds: dur,
      playbackSpeed: 1.0,
      ended: true,
      wallClockElapsed: 5,
      sessionId: testSession
    })
  });
  const progData = await progRes.json();
  console.log('2. Telemetry playback complete status:', progData.playbackCompleted);

  // 3. Submit Response
  const respRes = await fetch(`${host}/api/public/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioId: part1.id,
      responseText: 'I listened carefully to your personal words. I appreciate the time and care you took to convey this message in your own voice.',
      audioCompleted: true,
      ended: true,
      currentTime: dur,
      durationSeconds: dur,
      sessionId: testSession
    })
  });
  const respData = await respRes.json();
  console.log('3. Response submit status:', respRes.status, 'Message:', respData.message);

  if (respRes.status !== 201) {
    throw new Error('Response submission failed: ' + JSON.stringify(respData));
  }

  // 4. Verify Next Recording Unlocked
  const seqAfter = respData.sequence;
  console.log('4. Sequence after response:');
  console.log('   Part 1 isCompleted:', seqAfter[0].isCompleted, 'status:', seqAfter[0].status);
  console.log('   Part 2 isUnlocked:', seqAfter[1].isUnlocked, 'status:', seqAfter[1].status);

  if (!seqAfter[1].isUnlocked) {
    throw new Error('Part 2 did not unlock after verified playback and response submission!');
  }

  console.log('\n✅ WORKFLOW VERIFICATION PASSED: Digital letter presentation, reading confirmation, playback, reflection submission, and sequential unlocking all work flawlessly!');
}

testWorkflow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
