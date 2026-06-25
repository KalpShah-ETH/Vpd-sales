const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING ADMIN_GLOBAL EXCLUSION AND STOCK COUNTING TESTS ---');
  let adminSessionCookie = null;

  function extractCookie(res, name) {
    const cookies = res.headers.get('set-cookie');
    if (!cookies) return null;
    const match = cookies.match(new RegExp(`${name}=([^;]+)`));
    return match ? `${name}=${match[1]}` : null;
  }

  // 1. Login as admin
  console.log('\nTest 1: Logging in as admin...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200);
  adminSessionCookie = extractCookie(loginRes, 'admin_session');
  console.log('✓ Successfully logged in as admin');

  // 2. Fetch salesmen list and ensure admin_global is NOT present
  console.log('\nTest 2: Fetching salesmen and ensuring admin_global is excluded...');
  const salesmenRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
    headers: { 'Cookie': adminSessionCookie }
  });
  assert.strictEqual(salesmenRes.status, 200);
  const salesmen = await salesmenRes.json();
  
  const globalInList = salesmen.find(s => s.username === 'admin_global');
  assert.ok(!globalInList, 'admin_global should NOT be in the admin salesmen listing');
  console.log('✓ Verified: admin_global excluded from salesmen listing successfully');

  // 3. Create a test salesman and get initial catalog stats
  console.log('\nTest 3: Creating test salesman...');
  const testPhone = '88' + Math.floor(10000000 + Math.random() * 90000000);
  const createRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminSessionCookie
    },
    body: JSON.stringify({
      name: 'Test Count Salesman',
      companyName: 'Count Company',
      phone: testPhone,
      username: testPhone,
      password: 'password123'
    })
  });
  assert.strictEqual(createRes.status, 200);
  const createData = await createRes.json();
  const salesmanId = createData.salesman.id;
  console.log(`✓ Test salesman created (ID: ${salesmanId})`);

  // Fetch updated listing to inspect the count
  const listingRes1 = await fetch(`${BASE_URL}/api/admin/salesman`, {
    headers: { 'Cookie': adminSessionCookie }
  });
  const salesmenList1 = await listingRes1.json();
  const targetSalesman1 = salesmenList1.find(s => s.id === salesmanId);
  assert.ok(targetSalesman1, 'Salesman should be present in listing');
  const initialStockCount = targetSalesman1._count.stockItems;
  console.log(`Initial stock count: ${initialStockCount}`);

  // 4. Upload global stock
  console.log('\nTest 4: Admin uploading shared stock...');
  const bulkStockRes = await fetch(`${BASE_URL}/api/admin/salesman/bulk-stock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminSessionCookie
    },
    body: JSON.stringify({
      items: [
        { name: 'Exclusive Global Med A', mfg: 'Global Mfg', pack: '10s', quantity: 15 },
        { name: 'Exclusive Global Med B', mfg: 'Global Mfg', pack: '10s', quantity: 20 }
      ]
    })
  });
  assert.strictEqual(bulkStockRes.status, 200);
  console.log('✓ Shared stock uploaded');

  // Fetch salesmen listing again and verify the count has increased by 2
  const listingRes2 = await fetch(`${BASE_URL}/api/admin/salesman`, {
    headers: { 'Cookie': adminSessionCookie }
  });
  const salesmenList2 = await listingRes2.json();
  const targetSalesman2 = salesmenList2.find(s => s.id === salesmanId);
  const finalStockCount = targetSalesman2._count.stockItems;
  console.log(`Final stock count: ${finalStockCount}`);
  
  assert.strictEqual(finalStockCount, initialStockCount + 2, 'Salesman catalogue count should include the 2 newly added global stock items');
  console.log('✓ Verified: Salesman catalogue count updated dynamically with shared stock');

  // 5. Cleanup
  console.log('\nTest 5: Cleaning up test salesman...');
  const cleanupRes = await fetch(`${BASE_URL}/api/admin/salesman?id=${salesmanId}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminSessionCookie }
  });
  assert.strictEqual(cleanupRes.status, 200);
  console.log('✓ Cleaned up successfully');

  console.log('\n--- ALL EXCLUSION AND STOCK COUNT TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
