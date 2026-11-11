const http = require('http');
const fs = require('fs');
const path = require('path');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wasimkham7861@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wasim0786';

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', reject);
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

function parseCookies(cookieHeaders) {
  if (!cookieHeaders) return '';
  if (Array.isArray(cookieHeaders)) {
    return cookieHeaders.map(c => c.split(';')[0]).join('; ');
  }
  return cookieHeaders.split(';')[0];
}

async function run() {
  console.log('🧪 Starting Welcome Image Upload Verification Test...');

  // Step 1: Login
  console.log('1️⃣ Logging in as admin...');
  const loginPayload = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, loginPayload);

  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed (${loginRes.statusCode}): ${loginRes.data}`);
  }
  const cookies = parseCookies(loginRes.headers['set-cookie']);
  console.log('✅ Admin login successful. Session cookie acquired.');

  // Create test dummy images
  const testDir = path.join(__dirname, 'test-assets');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  // 1x1 minimal valid PNG
  const minimalPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082', 'hex');
  const pngPath = path.join(testDir, 'sample.png');
  const jfifPath = path.join(testDir, 'photo.jfif');
  const txtPath = path.join(testDir, 'fake.txt');

  fs.writeFileSync(pngPath, minimalPng);
  fs.writeFileSync(jfifPath, minimalPng);
  fs.writeFileSync(txtPath, 'This is a text file, not an image.');

  // Helper to build multipart/form-data
  function makeMultipart(fieldName, filePath, mimeType) {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const filename = path.basename(filePath);
    const fileBytes = fs.readFileSync(filePath);

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileBytes, footer]);

    return {
      contentType: `multipart/form-data; boundary=${boundary}`,
      body
    };
  }

  // Step 2: Upload standard PNG image
  console.log('\n2️⃣ Testing upload of standard PNG image...');
  const pngMultipart = makeMultipart('welcomeImage', pngPath, 'image/png');
  const uploadPngRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/welcome-settings/image',
    method: 'POST',
    headers: {
      'Content-Type': pngMultipart.contentType,
      'Content-Length': pngMultipart.body.length,
      'Cookie': cookies,
      'Accept': 'application/json'
    }
  }, pngMultipart.body);

  console.log(`Status: ${uploadPngRes.statusCode}`);
  const pngJson = JSON.parse(uploadPngRes.data);
  if (!pngJson.success) {
    throw new Error(`PNG Upload failed: ${uploadPngRes.data}`);
  }
  console.log('✅ PNG upload succeeded:', pngJson.message);
  console.log('   Image URL:', pngJson.settings?.imageUrl);

  // Step 3: Upload .jfif image (common Windows camera format)
  console.log('\n3️⃣ Testing upload of .jfif image...');
  const jfifMultipart = makeMultipart('welcomeImage', jfifPath, 'image/jpeg');
  const uploadJfifRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/welcome-settings/image',
    method: 'POST',
    headers: {
      'Content-Type': jfifMultipart.contentType,
      'Content-Length': jfifMultipart.body.length,
      'Cookie': cookies,
      'Accept': 'application/json'
    }
  }, jfifMultipart.body);

  console.log(`Status: ${uploadJfifRes.statusCode}`);
  const jfifJson = JSON.parse(uploadJfifRes.data);
  if (!jfifJson.success) {
    throw new Error(`.jfif Upload failed: ${uploadJfifRes.data}`);
  }
  console.log('✅ .jfif upload succeeded:', jfifJson.message);

  // Step 4: Test invalid file upload and verify it returns JSON error (NOT HTML DOCTYPE)
  console.log('\n4️⃣ Testing invalid file upload (txt file) - verifying clean JSON error (no HTML DOCTYPE)...');
  const txtMultipart = makeMultipart('welcomeImage', txtPath, 'text/plain');
  const uploadTxtRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/welcome-settings/image',
    method: 'POST',
    headers: {
      'Content-Type': txtMultipart.contentType,
      'Content-Length': txtMultipart.body.length,
      'Cookie': cookies,
      'Accept': 'application/json'
    }
  }, txtMultipart.body);

  console.log(`Status: ${uploadTxtRes.statusCode}`);
  console.log('Response content-type:', uploadTxtRes.headers['content-type']);
  console.log('Response body:', uploadTxtRes.data);

  if (uploadTxtRes.data.includes('<!DOCTYPE') || uploadTxtRes.data.startsWith('<')) {
    throw new Error('❌ FAILED: Server returned HTML error page instead of JSON!');
  }

  const errJson = JSON.parse(uploadTxtRes.data);
  if (errJson.success !== false) {
    throw new Error('Expected success: false for invalid file format.');
  }
  console.log('✅ Correctly received structured JSON error message:', errJson.error);

  // Step 5: Test public image serving endpoint
  console.log('\n5️⃣ Testing GET /api/public/welcome-image...');
  const imgRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/public/welcome-image',
    method: 'GET'
  });
  console.log(`Status: ${imgRes.statusCode}, Content-Type: ${imgRes.headers['content-type']}`);
  if (imgRes.statusCode !== 200 && imgRes.statusCode !== 302) {
    throw new Error(`Failed to fetch welcome image: ${imgRes.statusCode}`);
  }
  console.log('✅ Welcome image endpoint responded successfully.');

  // Clean up test assets
  try {
    fs.unlinkSync(pngPath);
    fs.unlinkSync(jfifPath);
    fs.unlinkSync(txtPath);
  } catch {}

  console.log('\n🎉 ALL TESTS PASSED! Image upload works flawlessly and never throws DOCTYPE / JSON syntax errors.');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

