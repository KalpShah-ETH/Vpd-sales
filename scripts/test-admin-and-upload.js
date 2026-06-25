const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING ADMIN CREATION & IMAGE UPLOAD TESTS ---');
  let adminSessionCookie = null;
  let newAdminSessionCookie = null;

  // Helper to extract cookies
  function extractCookie(res, name) {
    const cookies = res.headers.get('set-cookie');
    if (!cookies) return null;
    const match = cookies.match(new RegExp(`${name}=([^;]+)`));
    return match ? `${name}=${match[1]}` : null;
  }

  // 1. Login as primary admin (admin / admin123)
  console.log('\nTest 1: Logging in as primary admin...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  assert.strictEqual(loginRes.status, 200, 'Login should succeed');
  adminSessionCookie = extractCookie(loginRes, 'admin_session');
  assert.ok(adminSessionCookie, 'Should receive admin_session cookie');
  console.log('✓ Successfully logged in as primary admin');

  // 2. Create a new admin account
  console.log('\nTest 2: Creating a new admin account...');
  const newUsername = `newadmin_${Date.now()}`;
  const newPassword = 'newadminpassword123';

  const createAdminRes = await fetch(`${BASE_URL}/api/admin/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminSessionCookie
    },
    body: JSON.stringify({ username: newUsername, password: newPassword })
  });

  assert.strictEqual(createAdminRes.status, 200, 'Admin creation should succeed');
  const createAdminData = await createAdminRes.json();
  assert.ok(createAdminData.success, 'Result should indicate success');
  assert.strictEqual(createAdminData.admin.username, newUsername, 'Username should match');
  console.log(`✓ Created admin account: ${newUsername}`);

  // 3. Log out primary admin
  console.log('\nTest 3: Logging out primary admin...');
  const logoutRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'DELETE',
    headers: { 'Cookie': adminSessionCookie }
  });
  assert.strictEqual(logoutRes.status, 200, 'Logout should succeed');
  console.log('✓ Successfully logged out');

  // 4. Log in as the newly created admin
  console.log('\nTest 4: Logging in as the new admin...');
  const newLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: newUsername, password: newPassword })
  });
  assert.strictEqual(newLoginRes.status, 200, 'New admin login should succeed');
  newAdminSessionCookie = extractCookie(newLoginRes, 'admin_session');
  assert.ok(newAdminSessionCookie, 'Should receive new admin session cookie');
  console.log('✓ Successfully logged in as the new admin');

  // 5. Upload background image (JPG)
  console.log('\nTest 5: Uploading JPEG background image...');
  const dummyJpg = Buffer.from('dummy-jpeg-content');
  const formDataJpg = new FormData();
  formDataJpg.append('file', new Blob([dummyJpg], { type: 'image/jpeg' }), 'test-bg.jpg');

  const uploadJpgRes = await fetch(`${BASE_URL}/api/admin/background`, {
    method: 'POST',
    headers: {
      'Cookie': newAdminSessionCookie
    },
    body: formDataJpg
  });

  assert.strictEqual(uploadJpgRes.status, 200, 'JPG upload should succeed');
  const uploadJpgData = await uploadJpgRes.json();
  assert.ok(uploadJpgData.success, 'Upload success status should be true');
  console.log('✓ Successfully uploaded JPG background image');

  // 6. Upload background image (PNG)
  console.log('\nTest 6: Uploading PNG background image...');
  const dummyPng = Buffer.from('dummy-png-content');
  const formDataPng = new FormData();
  formDataPng.append('file', new Blob([dummyPng], { type: 'image/png' }), 'test-bg.png');

  const uploadPngRes = await fetch(`${BASE_URL}/api/admin/background`, {
    method: 'POST',
    headers: {
      'Cookie': newAdminSessionCookie
    },
    body: formDataPng
  });

  assert.strictEqual(uploadPngRes.status, 200, 'PNG upload should succeed');
  const uploadPngData = await uploadPngRes.json();
  assert.ok(uploadPngData.success, 'Upload success status should be true');
  console.log('✓ Successfully uploaded PNG background image');

  // 7. Verify dynamic serving route matches uploaded MIME and data
  console.log('\nTest 7: Verification of dynamic image serving endpoint...');
  const bgServeRes = await fetch(`${BASE_URL}/api/retailer/bg-image`);
  assert.strictEqual(bgServeRes.status, 200, 'BG serving endpoint should succeed');
  assert.strictEqual(bgServeRes.headers.get('content-type'), 'image/png', 'MIME type should match the last uploaded image (PNG)');
  const bgBytes = await bgServeRes.arrayBuffer();
  const bgBuffer = Buffer.from(bgBytes);
  assert.strictEqual(bgBuffer.toString(), 'dummy-png-content', 'Content should match PNG dummy data');
  console.log('✓ Serve endpoint works correctly and returned the exact file');

  // 8. Upload background image (invalid text format)
  console.log('\nTest 8: Uploading invalid file format (text/plain)...');
  const dummyText = Buffer.from('dummy-text-content');
  const formDataText = new FormData();
  formDataText.append('file', new Blob([dummyText], { type: 'text/plain' }), 'test-bg.txt');

  const uploadTextRes = await fetch(`${BASE_URL}/api/admin/background`, {
    method: 'POST',
    headers: {
      'Cookie': newAdminSessionCookie
    },
    body: formDataText
  });

  assert.strictEqual(uploadTextRes.status, 400, 'Invalid format should be blocked with 400 Bad Request');
  const uploadTextData = await uploadTextRes.json();
  assert.ok(uploadTextData.error.includes('Only JPG, JPEG, and PNG'), 'Error message should specify only JPG, JPEG, and PNG are allowed');
  console.log('✓ Successfully blocked invalid file formats');

  console.log('\n--- ALL ADMIN & IMAGE UPLOAD TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
