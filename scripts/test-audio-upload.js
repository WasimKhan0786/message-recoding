#!/usr/bin/env node

/**
 * AudioFlow - Test Audio Upload & Conversion Pipeline
 * 1. Generates a small synthetic test WAV audio file using FFmpeg.
 * 2. Transcodes to MP3 at 128 kbps.
 * 3. Uploads the 128kbps MP3 to Filebase S3.
 * 4. Verifies streaming from Filebase S3.
 * 5. Cleans up test artifacts.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const ffmpegService = require('../src/services/ffmpegService');
const s3Service = require('../src/services/s3Service');
const { tempUploadDir } = require('../src/middleware/uploadMiddleware');

async function runAudioTest() {
  console.log('====================================================');
  console.log('🎵 AudioFlow — Audio Upload & Conversion Pipeline Test');
  console.log('====================================================\n');

  const rawWavPath = path.join(tempUploadDir, `test_synth_${Date.now()}.wav`);
  const convertedMp3Path = path.join(tempUploadDir, `test_converted_${Date.now()}.mp3`);
  let s3UploadedKey = null;

  try {
    // Step 1: Synthesize a small 3-second 440Hz sine wave tone WAV file using FFmpeg
    console.log('Step 1: Generating a 3-second test WAV audio file...');
    const genResult = spawnSync(ffmpegPath, [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=3',
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      '-y',
      rawWavPath
    ]);

    if (genResult.status !== 0 || !fs.existsSync(rawWavPath)) {
      throw new Error(`Failed to synthesize test audio: ${genResult.stderr.toString()}`);
    }

    const rawSize = fs.statSync(rawWavPath).size;
    console.log(`✅ Generated test WAV file: ${(rawSize / 1024).toFixed(1)} KB`);

    // Step 2: Convert to MP3 at 128 kbps using ffmpegService
    console.log('\nStep 2: Transcoding to MP3 at 128 kbps via FFmpeg...');
    const startTime = Date.now();
    const result = await ffmpegService.convertToMp3128k(rawWavPath, convertedMp3Path, (pct) => {
      process.stdout.write(`  Transcoding progress: ${pct}%\r`);
    });
    const transcodeDuration = Date.now() - startTime;

    console.log(`✅ Transcoding complete in ${transcodeDuration}ms`);
    console.log(`  • Output format:   MP3 128 kbps`);
    console.log(`  • Output duration: ${result.durationFormatted} (${result.durationSeconds}s)`);
    console.log(`  • Output size:     ${(result.fileSize / 1024).toFixed(1)} KB`);

    // Step 3: Upload the 128 kbps MP3 to Filebase S3
    s3UploadedKey = `audio/test-${Date.now()}-tone.mp3`;
    console.log(`\nStep 3: Uploading converted MP3 to Filebase S3 (${s3UploadedKey})...`);
    const uploadStart = Date.now();
    const s3Result = await s3Service.uploadAudioFile({
      filePath: convertedMp3Path,
      key: s3UploadedKey,
      contentType: 'audio/mpeg'
    });
    const uploadDuration = Date.now() - uploadStart;

    console.log(`✅ Successfully uploaded to Filebase S3 in ${uploadDuration}ms!`);
    console.log(`  • Bucket: ${s3Result.bucket}`);
    console.log(`  • S3 Key: ${s3Result.key}`);
    console.log(`  • ETag:   ${s3Result.etag}`);

    // Step 4: Verify streaming playback from Filebase S3 (first 1024 bytes via Range request)
    console.log('\nStep 4: Testing stream playback from Filebase S3 via HTTP Range...');
    const streamResult = await s3Service.getAudioStream({
      key: s3UploadedKey,
      range: 'bytes=0-1024'
    });

    console.log(`✅ S3 stream verified! HTTP Status: ${streamResult.statusCode}, Content-Type: ${streamResult.contentType}`);

    // Step 5: Clean up S3 test file and local temp files
    console.log('\nStep 5: Cleaning up test artifacts...');
    await s3Service.deleteAudioFromS3(s3UploadedKey);
    console.log('✅ Removed test file from Filebase S3.');

    safeDelete(rawWavPath);
    safeDelete(convertedMp3Path);
    console.log('✅ Removed local temporary files.');

    console.log('\n====================================================');
    console.log('🎉 AUDIO UPLOAD & CONVERSION PIPELINE VERIFIED 100%!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Audio pipeline test failed:', err.message);
    safeDelete(rawWavPath);
    safeDelete(convertedMp3Path);
    if (s3UploadedKey) {
      s3Service.deleteAudioFromS3(s3UploadedKey).catch(() => {});
    }
    process.exit(1);
  }
}

function safeDelete(f) {
  try {
    if (f && fs.existsSync(f)) fs.unlinkSync(f);
  } catch {}
}

runAudioTest();

