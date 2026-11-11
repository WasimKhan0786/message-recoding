#!/usr/bin/env node

/**
 * AudioFlow - Safe Filebase S3 Connection Diagnostic Script
 *
 * Verifies bucket access via HeadBucketCommand without uploading or deleting files.
 * Credentials are never printed or logged.
 */

require('dotenv').config();
const { testFilebaseConnection } = require('../src/services/s3Service');

function maskString(str) {
  if (!str) return '[NOT CONFIGURED]';
  const clean = String(str).trim();
  if (clean.length <= 4) return '****';
  return '•'.repeat(Math.max(4, clean.length - 4)) + clean.slice(-4);
}

async function run() {
  console.log('====================================================');
  console.log('🌐 AudioFlow — Filebase S3 Connection Test');
  console.log('====================================================\n');

  const endpoint = (process.env.S3_ENDPOINT || 'https://s3.filebase.io').trim();
  const region = (process.env.S3_REGION || 'auto').trim();
  const bucket = process.env.S3_BUCKET ? process.env.S3_BUCKET.trim() : '[NOT CONFIGURED]';
  const accessKey = process.env.S3_ACCESS_KEY_ID ? process.env.S3_ACCESS_KEY_ID.trim() : '';
  const secretKey = process.env.S3_SECRET_ACCESS_KEY ? process.env.S3_SECRET_ACCESS_KEY.trim() : '';

  console.log('Parameters:');
  console.log(`  • Endpoint:          ${endpoint}`);
  console.log(`  • Region:            ${region}`);
  console.log(`  • Target Bucket:     ${bucket}`);
  console.log(`  • Access Key ID:     ${accessKey ? `Configured (${accessKey.length} chars, ending in ${maskString(accessKey).slice(-4)})` : '❌ Missing'}`);
  console.log(`  • Secret Access Key: ${secretKey ? `Configured (${secretKey.length} chars, hidden for security)` : '❌ Missing'}`);
  console.log('\nExecuting HeadBucketCommand...');

  const startTime = Date.now();
  const result = await testFilebaseConnection();
  const duration = Date.now() - startTime;

  console.log('----------------------------------------------------');
  if (result.success) {
    console.log(`✅ SUCCESS (${duration}ms)`);
    console.log(`Message: ${result.message}`);
    console.log(`Status:  Bucket "${result.bucket}" is reachable and authorized.`);
    console.log('====================================================\n');
    process.exit(0);
  } else {
    console.error(`❌ CONNECTION FAILED (${duration}ms)`);
    console.error(`Message: ${result.message}`);
    if (result.hint) {
      console.warn(`💡 Hint:    ${result.hint}`);
    }
    if (result.statusCode) {
      console.error(`HTTP Status: ${result.statusCode}`);
    }
    console.log('====================================================\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\n❌ Unexpected fatal diagnostic error:', err.message);
  process.exit(1);
});
