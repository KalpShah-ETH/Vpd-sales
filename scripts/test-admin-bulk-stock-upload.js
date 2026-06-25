const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING ADMIN BULK STOCK UPLOAD TO ALL SALESMEN TESTS ---');
  let adminSessionCookie = null;

  // Helper to extract cookies
  function extractCookie(res, name) {
    const cookies = res.headers.get('set-cookie');
    if (!cookies) return null;
    const match = cookies.match(new RegExp(`${name}=([^;]+)`));
    return match ? `${name}=${match[1]}` : null;
  }

  // 1. Login as primary admin
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

  // 2. Create two test salesmen
  console.log('\nTest 2: Creating two test salesmen...');
  const testPhone1 = '87' + Math.floor(10000000 + Math.random() * 90000000);
  const testPhone2 = '87' + Math.floor(10000000 + Math.random() * 90000000);

  // Salesman 1
  const createSalesmanRes1 = await fetch(`${BASE_URL}/api/admin/salesman`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminSessionCookie
    },
    body: JSON.stringify({
      name: 'Salesman A',
      companyName: 'Company Alpha',
      phone: testPhone1,
      username: testPhone1,
      password: 'password123'
    })
  });
  assert.strictEqual(createSalesmanRes1.status, 200, 'Salesman A creation should succeed');
  const salesmanData1 = await createSalesmanRes1.json();
  const salesmanId1 = salesmanData1.salesman.id;
  console.log(`✓ Created Salesman A (ID: ${salesmanId1}, Company: Company Alpha)`);

  // Salesman 2
  const createSalesmanRes2 = await fetch(`${BASE_URL}/api/admin/salesman`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminSessionCookie
    },
    body: JSON.stringify({
      name: 'Salesman B',
      companyName: 'Company Beta',
      phone: testPhone2,
      username: testPhone2,
      password: 'password123'
    })
  });
  assert.strictEqual(createSalesmanRes2.status, 200, 'Salesman B creation should succeed');
  const salesmanData2 = await createSalesmanRes2.json();
  const salesmanId2 = salesmanData2.salesman.id;
  console.log(`✓ Created Salesman B (ID: ${salesmanId2}, Company: Company Beta)`);

  // 3. Admin bulk upload stock to all salesmen
  console.log('\nTest 3: Admin bulk upload stock to ALL salesmen...');
  const bulkStockRes = await fetch(`${BASE_URL}/api/admin/salesman/bulk-stock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminSessionCookie
    },
    body: JSON.stringify({
      items: [
        { name: 'Unified Medicine X', mfg: 'Mfg Unified', pack: '10s', quantity: 99 },
        { name: 'Unified Medicine Y', mfg: 'Mfg Unified', pack: '30s', quantity: 199 }
      ]
    })
  });

  assert.strictEqual(bulkStockRes.status, 200, 'Bulk stock upload should succeed');
  const bulkStockData = await bulkStockRes.json();
  assert.strictEqual(bulkStockData.success, true, 'Response success should be true');
  // It should insert exactly 2 items globally
  assert.strictEqual(bulkStockData.inserted, 2, `Should have inserted exactly 2 items (inserted: ${bulkStockData.inserted})`);
  console.log(`✓ Bulk uploaded successfully. Saved centrally as shared stock (total inserted: ${bulkStockData.inserted})`);

  // 4. Verify both salesmen companies have the items visible in browse catalog
  console.log('\nTest 4: Verify items are visible under both companies in browse catalog...');
  const browseRes = await fetch(`${BASE_URL}/api/retailer/browse`, {
    headers: { 'Cookie': adminSessionCookie }
  });
  assert.strictEqual(browseRes.status, 200, 'Browse route should succeed');
  const catalog = await browseRes.json();
  
  // Verify Company Alpha
  const companyAlpha = catalog.find(c => c.companyName === 'Company Alpha');
  assert.ok(companyAlpha, 'Company Alpha should be in catalog');
  const medAlphaX = companyAlpha.stockItems.find(i => i.name === 'Unified Medicine X');
  assert.ok(medAlphaX, 'Company Alpha should contain Unified Medicine X');
  assert.strictEqual(medAlphaX.isAdminGlobal, true, 'Unified Medicine X should be marked as global');
  const alphaMeds = companyAlpha.stockItems.map(i => i.name);
  assert.ok(alphaMeds.includes('Unified Medicine Y'), 'Company Alpha should contain Unified Medicine Y');
  console.log('✓ Verified: Company Alpha received the stock upload with isAdminGlobal flag');

  // Verify Company Beta
  const companyBeta = catalog.find(c => c.companyName === 'Company Beta');
  assert.ok(companyBeta, 'Company Beta should be in catalog');
  const medBetaX = companyBeta.stockItems.find(i => i.name === 'Unified Medicine X');
  assert.ok(medBetaX, 'Company Beta should contain Unified Medicine X');
  assert.strictEqual(medBetaX.isAdminGlobal, true, 'Unified Medicine X should be marked as global');
  const betaMeds = companyBeta.stockItems.map(i => i.name);
  assert.ok(betaMeds.includes('Unified Medicine Y'), 'Company Beta should contain Unified Medicine Y');
  console.log('✓ Verified: Company Beta received the stock upload with isAdminGlobal flag');

  // Cleanup: Delete both test salesmen
  console.log('\nTest 5: Cleaning up test salesmen...');
  const cleanupRes1 = await fetch(`${BASE_URL}/api/admin/salesman?id=${salesmanId1}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminSessionCookie }
  });
  assert.strictEqual(cleanupRes1.status, 200, 'Salesman A deletion should succeed');

  const cleanupRes2 = await fetch(`${BASE_URL}/api/admin/salesman?id=${salesmanId2}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminSessionCookie }
  });
  assert.strictEqual(cleanupRes2.status, 200, 'Salesman B deletion should succeed');
  console.log('✓ Cleaned up test salesmen successfully');

  console.log('\n--- ALL ADMIN BULK STOCK UPLOAD TO ALL SALESMEN TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
