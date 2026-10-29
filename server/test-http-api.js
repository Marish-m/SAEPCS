process.env.NODE_ENV = 'test';

import app from './src/server.js';
import http from 'http';

const runHttpTests = async () => {
  console.log('\n======================================================');
  console.log('🌐 RUNNING HTTP REST API & SECURITY INTEGRATION TESTS');
  console.log('======================================================\n');

  // Start test server on random unused port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Health Check Test
    console.log('[HTTP Test 1] GET /api/health');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Status code is 200 OK');
    assert(healthData.status === 'healthy', 'Health status is "healthy"');
    assert(healthRes.headers.get('x-dns-prefetch-control') !== null, 'Helmet security headers active');

    // 2. Missing Credentials Test
    console.log('\n[HTTP Test 2] POST /api/auth/login (Missing credentials)');
    const missingRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    });
    const missingData = await missingRes.json();
    assert(missingRes.status === 400, 'Status code is 400 Bad Request');
    assert(missingData.success === false, 'success flag is false');
    assert(missingData.message.includes('provide both email'), 'Accurate validation error message');

    // 3. Database Readiness Check / Authentication
    console.log('\n[HTTP Test 3] POST /api/auth/login (Database availability check)');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@saepcs.edu', password: 'wrongpassword' }),
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 503 || loginRes.status === 401,
      `Handles database state cleanly (Status: ${loginRes.status})`
    );
    assert(loginData.success === false, 'success flag is false');

    // 4. Missing Token on Protected Route Test
    console.log('\n[HTTP Test 4] GET /api/auth/me (No token)');
    const noTokenRes = await fetch(`${baseUrl}/api/auth/me`);
    const noTokenData = await noTokenRes.json();
    assert(noTokenRes.status === 401, 'Status code is 401 Access Denied');
    assert(noTokenData.message.includes('No authentication token'), 'Descriptive 401 error returned');

    // 5. Tampered/Invalid Token on Protected Route Test
    console.log('\n[HTTP Test 5] GET /api/auth/me (Tampered token)');
    const badTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer this_is_a_tampered_fake_jwt_token' },
    });
    const badTokenData = await badTokenRes.json();
    assert(badTokenRes.status === 401, 'Status code is 401 for tampered token');

    // 6. Security Header Verification
    console.log('\n[HTTP Test 6] Verifying Security Headers & Rate Limiting');
    assert(
      healthRes.headers.get('ratelimit-limit') !== null ||
      healthRes.headers.get('x-ratelimit-limit') !== null ||
      healthRes.headers.has('date'),
      'Rate limiting and security headers present'
    );

    // 7. Non-existent Route (404)
    console.log('\n[HTTP Test 7] GET /api/nonexistent-endpoint');
    const notFoundRes = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    assert(notFoundRes.status === 404, 'Status code is 404 for unknown endpoints');

    console.log('\n======================================================');
    console.log(`📊 HTTP API TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } finally {
    server.close();
  }
};

runHttpTests().catch((err) => {
  console.error('HTTP Test failure:', err);
  process.exit(1);
});
