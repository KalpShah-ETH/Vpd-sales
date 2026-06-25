const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING SALESMAN LOGOUT ALERT & API TESTS ---');

  // Test 1: Check source code implementation of the logout confirmation alert in SalesmanDashboardClient
  console.log('\nTest 1: Verifying logout confirmation alert exists in SalesmanDashboardClient.jsx source...');
  const clientFilePath = path.join(__dirname, '../app/salesman/dashboard/SalesmanDashboardClient.jsx');
  const sourceCode = fs.readFileSync(clientFilePath, 'utf8');

  // Verify the triggerConfirm call matches admin's confirm modal parameters
  assert.ok(sourceCode.includes('triggerConfirm'), 'SalesmanDashboardClient should contain triggerConfirm implementation');
  assert.ok(sourceCode.includes('Confirm Logout'), 'SalesmanDashboardClient should trigger a Confirm Logout modal');
  assert.ok(sourceCode.includes('Are you sure you want to log out of your Salesman session?'), 'SalesmanDashboardClient should ask for confirmation message');
  console.log('✓ Verified: SalesmanDashboardClient contains the same unified ConfirmModal alert trigger as Admin');

  // Test 2: Verify Salesman Login and Logout API flow
  console.log('\nTest 2: Testing salesman login and session creation...');
  
  // Setup: Ensure we have a salesman to test with
  // We will login with test credentials (we'll fetch/create one if needed via api or direct to DB,
  // but let's first check if we can log in with a test number).
  // First, we can authenticate as admin to create a test salesman
  const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login should succeed');
  const setCookieHeader = adminLoginRes.headers.get('set-cookie');
  assert.ok(setCookieHeader, 'Should receive cookies');
  const adminCookie = setCookieHeader.split(';')[0];

  const testSalesmanPhone = '9090909090';
  const testSalesmanPassword = 'password123';

  // Create a salesman via Admin API
  const createSalesmanRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({
      name: 'Test Logout Salesman',
      companyName: 'Test Logout Pharma',
      phone: testSalesmanPhone,
      username: testSalesmanPhone,
      password: testSalesmanPassword
    })
  });

  const createSalesmanData = await createSalesmanRes.json();
  let createdSalesmanId = null;
  if (createSalesmanRes.status === 200 && createSalesmanData.success) {
    createdSalesmanId = createSalesmanData.salesman.id;
    console.log(`✓ Test salesman created with phone ${testSalesmanPhone} and ID ${createdSalesmanId}`);
  } else {
    // If already exists, we will proceed to login
    console.log('Test salesman might already exist, attempting login...');
  }

  // Now login as the salesman
  console.log('Attempting salesman login...');
  const salesmanLoginRes = await fetch(`${BASE_URL}/api/salesman/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testSalesmanPhone, password: testSalesmanPassword })
  });

  assert.strictEqual(salesmanLoginRes.status, 200, 'Salesman login should succeed');
  const salesmanSetCookie = salesmanLoginRes.headers.get('set-cookie');
  assert.ok(salesmanSetCookie, 'Should receive salesman cookie');
  const salesmanCookie = salesmanSetCookie.split(';')[0];
  console.log('✓ Salesman logged in successfully and received session cookie');

  // Test 3: Log out the salesman via API
  console.log('\nTest 3: Logging out salesman...');
  const logoutRes = await fetch(`${BASE_URL}/api/salesman/login`, {
    method: 'DELETE',
    headers: { 'Cookie': salesmanCookie }
  });

  assert.strictEqual(logoutRes.status, 200, 'Salesman logout should succeed');
  const logoutData = await logoutRes.json();
  assert.strictEqual(logoutData.success, true, 'Logout API response should indicate success');
  
  // Verify cookie is cleared (Max-Age=0 or Expires in past)
  const logoutCookieHeader = logoutRes.headers.get('set-cookie');
  assert.ok(logoutCookieHeader, 'Logout should set cookie headers to clear session');
  assert.ok(
    logoutCookieHeader.includes('Max-Age=0') || logoutCookieHeader.includes('Expires='), 
    'Cookie header should clear the salesman_session cookie'
  );
  console.log('✓ Salesman successfully logged out and session cleared');

  // Cleanup: Delete the test salesman
  if (createdSalesmanId) {
    console.log('\nTest 4: Cleaning up created test salesman...');
    const cleanupRes = await fetch(`${BASE_URL}/api/admin/salesman?id=${createdSalesmanId}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(cleanupRes.status, 200, 'Salesman cleanup should succeed');
    console.log('✓ Cleaned up test salesman successfully');
  }

  console.log('\n--- ALL SALESMAN LOGOUT ALERT & API TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
