/**
 * VPD Order System - Additional API Routes Test Suite
 * Runs against the running local development server at http://localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Additional API Routes Integration Tests...\n');

  let adminCookie = '';
  let salesmanCookie = '';
  let retailerCookie = '';

  let testSalesmanId = null;
  let testSalesman2Id = null;
  let testSalesmanPhone = `9800${Math.floor(100000 + Math.random() * 900000)}`;
  let testSalesmanUsername = `sales_rep_${Date.now()}`;
  let testSalesmanPassword = 'password123';

  let testRetailerId = null;
  let testRetailerPhone = `9700${Math.floor(100000 + Math.random() * 900000)}`;
  let testRetailerToken = '';

  let testStockItemId = null;
  let testOrderId = null;

  let errorsCount = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      errorsCount++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Initial Admin Auth
    // -------------------------------------------------------------
    console.log('--- Auth Setup ---');
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    assert(adminLoginRes.status === 200, 'Admin login status 200');
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginData.success, 'Admin login success response');
    adminCookie = adminLoginRes.headers.get('set-cookie').split(';')[0];

    // Create a Salesman for testing
    const createSalesmanRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        name: 'Test Rep Additional',
        companyName: 'Test Pharma Additional Co',
        phone: testSalesmanPhone,
        username: testSalesmanUsername,
        password: testSalesmanPassword
      })
    });
    const createSalesmanData = await createSalesmanRes.json();
    testSalesmanId = createSalesmanData.salesman.id;
    assert(!!testSalesmanId, `Created test salesman with ID: ${testSalesmanId}`);

    // Salesman Login
    const salesmanLoginRes = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testSalesmanPhone, password: testSalesmanPassword })
    });
    assert(salesmanLoginRes.status === 200, 'Salesman login status 200');
    salesmanCookie = salesmanLoginRes.headers.get('set-cookie').split(';')[0];

    // Create a Retailer assigned to salesman
    const createRetailerRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        shopName: 'Test Shop Additional',
        phone: testRetailerPhone
      })
    });
    const createRetailerData = await createRetailerRes.json();
    testRetailerId = createRetailerData.retailer.id;
    testRetailerToken = createRetailerData.retailer.token;
    assert(!!testRetailerId, `Created test retailer with ID: ${testRetailerId}`);

    // Link retailer to salesman
    await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        id: testRetailerId,
        regenerateToken: false
      })
    });

    // Login retailer
    const retailerAuthRes = await fetch(`${BASE_URL}/api/retailer/auth?token=${testRetailerToken}`, {
      redirect: 'manual'
    });
    retailerCookie = retailerAuthRes.headers.get('set-cookie').split(';')[0];
    assert(!!retailerCookie, 'Retailer session cookie obtained');

    // Create a stock item
    const createStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        name: 'Item A',
        price: 50.0,
        quantity: 100
      })
    });
    const createStockData = await createStockRes.json();
    testStockItemId = createStockData.item.id;
    assert(!!testStockItemId, `Created test stock item ID: ${testStockItemId}`);


    console.log('\n--- Running 18 Target API Route Tests ---');

    // 1. POST /api/retailer/order with items: [...] bulk array
    console.log('\nTest 1: POST /api/retailer/order with items bulk array');
    const bulkOrderRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': retailerCookie
      },
      body: JSON.stringify({
        items: [
          { stockItemId: testStockItemId, quantity: 10 }
        ]
      })
    });
    assert(bulkOrderRes.status === 200, 'Order status 200');
    const bulkOrderData = await bulkOrderRes.json();
    assert(bulkOrderData.success === true && !!bulkOrderData.waUrl, 'Order successfully placed via bulk array & WhatsApp URL returned');
    // Test 1.1: IDOR Prevention (Retailer trying to order from another company)
    console.log('\nTest 1.1: IDOR Prevention (Retailer trying to order from another company)');
    
    // Create second salesman
    const salesman2Phone = `9800${Math.floor(100000 + Math.random() * 900000)}`;
    const salesman2Username = `sales_rep_2_${Date.now()}`;
    const createSalesman2Res = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        name: 'Second Sales Rep',
        companyName: 'Second Pharma Co',
        phone: salesman2Phone,
        username: salesman2Username,
        password: testSalesmanPassword
      })
    });
    const createSalesman2Data = await createSalesman2Res.json();
    testSalesman2Id = createSalesman2Data.salesman.id;
    assert(!!testSalesman2Id, `Created second salesman ID: ${testSalesman2Id}`);

    // Log in as second salesman
    const loginSalesman2Res = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: salesman2Phone, password: testSalesmanPassword })
    });
    const salesman2Cookie = loginSalesman2Res.headers.get('set-cookie').split(';')[0];

    // Create a product for second salesman
    const createStock2Res = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesman2Cookie
      },
      body: JSON.stringify({
        name: 'Company B Secret Product',
        price: 99.9,
        quantity: 50
      })
    });
    const createStock2Data = await createStock2Res.json();
    const stockItem2Id = createStock2Data.item.id;
    assert(!!stockItem2Id, `Created Company B stock item ID: ${stockItem2Id}`);

    // Create a restricted retailer (linked to salesman 1)
    const restrictedRetailerPhone = `9700${Math.floor(100000 + Math.random() * 900000)}`;
    const createRestrictedRes = await fetch(`${BASE_URL}/api/salesman/retailers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        shopName: 'Restricted Shop',
        phone: restrictedRetailerPhone
      })
    });
    const createRestrictedData = await createRestrictedRes.json();
    const restrictedToken = createRestrictedData.retailer.token;

    // Login restricted retailer
    const restrictedAuthRes = await fetch(`${BASE_URL}/api/retailer/auth?token=${restrictedToken}`, {
      redirect: 'manual'
    });
    const restrictedRetailerCookie = restrictedAuthRes.headers.get('set-cookie').split(';')[0];

    // Restricted retailer (Company A) tries to order Company B's product
    const idorOrderRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': restrictedRetailerCookie
      },
      body: JSON.stringify({
        items: [
          { stockItemId: stockItem2Id, quantity: 1 }
        ]
      })
    });
    assert(idorOrderRes.status === 403, `IDOR Order rejected with status 403 (Forbidden). Got: ${idorOrderRes.status}`);
    const idorOrderData = await idorOrderRes.json();
    assert(idorOrderData.error && idorOrderData.error.includes('does not belong to your company'), 'Error message correctly states product does not belong to company catalog');


    // 2. PUT /api/salesman/orders (mark fulfilled)
    console.log('\nTest 2: PUT /api/salesman/orders (mark fulfilled)');
    // Fetch order ID
    const getOrdersRes = await fetch(`${BASE_URL}/api/salesman/orders`, {
      headers: { 'Cookie': salesmanCookie }
    });
    const orders = await getOrdersRes.json();
    const testOrder = orders.find(o => o.productName === 'Item A');
    testOrderId = testOrder?.id;
    assert(!!testOrderId, `Found pending order ID: ${testOrderId}`);

    const fulfillRes = await fetch(`${BASE_URL}/api/salesman/orders`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        id: testOrderId,
        status: 'FULFILLED'
      })
    });
    assert(fulfillRes.status === 200, 'Fulfill order status 200');
    const fulfillData = await fulfillRes.json();
    assert(fulfillData.success && fulfillData.order.status === 'FULFILLED', 'Order marked as FULFILLED');


    // 3. DELETE /api/salesman/stock?id=X
    console.log('\nTest 3: DELETE /api/salesman/stock?id=X');
    // Let's create an item to delete
    const deleteTargetRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        name: 'Item to Delete',
        price: 15.0,
        quantity: 10
      })
    });
    const deleteTargetData = await deleteTargetRes.json();
    const deleteId = deleteTargetData.item.id;

    const deleteRes = await fetch(`${BASE_URL}/api/salesman/stock?id=${deleteId}`, {
      method: 'DELETE',
      headers: { 'Cookie': salesmanCookie }
    });
    assert(deleteRes.status === 200, 'Delete stock item status 200');
    const deleteData = await deleteRes.json();
    assert(deleteData.success, 'Successfully deleted stock item');


    // 4. PUT /api/salesman/stock
    console.log('\nTest 4: PUT /api/salesman/stock (edit stock item)');
    const editRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        id: testStockItemId,
        name: 'Item A Updated',
        price: 55.5,
        quantity: 120
      })
    });
    assert(editRes.status === 200, 'Edit stock status 200');
    const editData = await editRes.json();
    assert(editData.success && editData.item.name === 'Item A Updated' && editData.item.price === 55.5, 'Stock item edited successfully');


    // 5. POST /api/salesman/stock/bulk (bulk upload)
    console.log('\nTest 5: POST /api/salesman/stock/bulk');
    const bulkStockRes = await fetch(`${BASE_URL}/api/salesman/stock/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        items: [
          { name: 'Bulk Product 1', price: 10.0, quantity: 50 },
          { name: 'Bulk Product 2', price: 20.0, quantity: 60 }
        ]
      })
    });
    assert(bulkStockRes.status === 200, 'Bulk stock status 200');
    const bulkStockData = await bulkStockRes.json();
    assert(bulkStockData.success && bulkStockData.inserted === 2, 'Inserted 2 items in bulk stock upload');


    // 6. POST /api/salesman/retailers (create retailer from salesman)
    console.log('\nTest 6: POST /api/salesman/retailers');
    const salesmanRetailerPhone = `9600${Math.floor(100000 + Math.random() * 900000)}`;
    const salesmanRetailerRes = await fetch(`${BASE_URL}/api/salesman/retailers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        shopName: 'Shop Created By Salesman',
        phone: salesmanRetailerPhone
      })
    });
    assert(salesmanRetailerRes.status === 200, 'Salesman retailer creation status 200');
    const salesmanRetailerData = await salesmanRetailerRes.json();
    assert(salesmanRetailerData.success && salesmanRetailerData.retailer.salesmanId === testSalesmanId, 'Retailer created & assigned to salesman');


    // 7. PUT /api/admin/retailer with regenerateToken: true
    console.log('\nTest 7: PUT /api/admin/retailer with regenerateToken: true');
    const regenTokenRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        id: testRetailerId,
        regenerateToken: true
      })
    });
    assert(regenTokenRes.status === 200, 'Regen token status 200');
    const regenTokenData = await regenTokenRes.json();
    assert(regenTokenData.success && regenTokenData.retailer.token !== testRetailerToken, 'Retailer token successfully regenerated');
    
    // Update our reference
    const oldRetailerToken = testRetailerToken;
    testRetailerToken = regenTokenData.retailer.token;


    // 8. PUT /api/admin/retailer with active: false (deactivate)
    console.log('\nTest 8: PUT /api/admin/retailer with active: false');
    const deactivateRetailerRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        id: testRetailerId,
        active: false
      })
    });
    assert(deactivateRetailerRes.status === 200, 'Deactivate retailer status 200');
    const deactivateRetailerData = await deactivateRetailerRes.json();
    assert(deactivateRetailerData.success && deactivateRetailerData.retailer.active === false, 'Retailer deactivated');


    // 9. PUT /api/admin/salesman with active: false (deactivate)
    console.log('\nTest 9: PUT /api/admin/salesman with active: false');
    const deactivateSalesmanRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        id: testSalesmanId,
        active: false
      })
    });
    assert(deactivateSalesmanRes.status === 200, 'Deactivate salesman status 200');
    const deactivateSalesmanData = await deactivateSalesmanRes.json();
    assert(deactivateSalesmanData.success && deactivateSalesmanData.salesman.active === false, 'Salesman deactivated');


    // 10. POST /api/admin/salesman with salesmen: [...] bulk array
    console.log('\nTest 10: POST /api/admin/salesman with salesmen bulk array');
    const bulkSalesmanPhone1 = `9500${Math.floor(100000 + Math.random() * 900000)}`;
    const bulkSalesmanPhone2 = `9500${Math.floor(100000 + Math.random() * 900000)}`;
    const bulkSalesmanRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        salesmen: [
          { name: 'Bulk Salesman 1', companyName: 'Bulk Co 1', phone: bulkSalesmanPhone1, password: 'pwd' },
          { name: 'Bulk Salesman 2', companyName: 'Bulk Co 2', phone: bulkSalesmanPhone2, password: 'pwd' }
        ]
      })
    });
    assert(bulkSalesmanRes.status === 200, 'Bulk salesman status 200');
    const bulkSalesmanData = await bulkSalesmanRes.json();
    assert(bulkSalesmanData.success && bulkSalesmanData.count >= 2, `Salesmen bulk upload success. Count: ${bulkSalesmanData.count}`);


    // 11. POST /api/admin/retailer with retailers: [...] bulk array
    console.log('\nTest 11: POST /api/admin/retailer with retailers bulk array');
    const bulkRetailerPhone1 = `9400${Math.floor(100000 + Math.random() * 900000)}`;
    const bulkRetailerPhone2 = `9400${Math.floor(100000 + Math.random() * 900000)}`;
    const bulkRetailerRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        retailers: [
          { shopName: 'Bulk Retailer 1', phone: bulkRetailerPhone1 },
          { shopName: 'Bulk Retailer 2', phone: bulkRetailerPhone2 }
        ]
      })
    });
    assert(bulkRetailerRes.status === 200, 'Bulk retailer status 200');
    const bulkRetailerData = await bulkRetailerRes.json();
    assert(bulkRetailerData.success && bulkRetailerData.count >= 2, `Retailers bulk upload success. Count: ${bulkRetailerData.count}`);


    // 12. POST /api/admin/background (file upload)
    console.log('\nTest 12: POST /api/admin/background (file upload)');
    const formData = new FormData();
    const dummyBlob = new Blob(['dummy content'], { type: 'image/jpeg' });
    formData.append('file', dummyBlob, 'retailer-bg.jpg');

    const bgUploadRes = await fetch(`${BASE_URL}/api/admin/background`, {
      method: 'POST',
      headers: {
        'Cookie': adminCookie
      },
      body: formData
    });
    assert(bgUploadRes.status === 200, 'Background image upload status 200');
    const bgUploadData = await bgUploadRes.json();
    assert(bgUploadData.success === true && !!bgUploadData.version, 'Background image uploaded and version returned');


    // 13. GET /api/cron/cleanup (with and without secret)
    console.log('\nTest 13: GET /api/cron/cleanup (with and without secret)');
    
    // 13.1 Request without secret should fail with 401
    const cleanupNoSecretRes = await fetch(`${BASE_URL}/api/cron/cleanup`);
    assert(cleanupNoSecretRes.status === 401, 'Cleanup without secret fails with status 401');

    // 13.2 Request with incorrect secret should fail with 401
    const cleanupWrongSecretRes = await fetch(`${BASE_URL}/api/cron/cleanup?secret=wrongsecret`);
    assert(cleanupWrongSecretRes.status === 401, 'Cleanup with wrong secret fails with status 401');
    
    // 13.3 Request with correct secret should succeed with 200
    const cleanupSecretRes = await fetch(`${BASE_URL}/api/cron/cleanup?secret=test-cron-secret`);
    assert(cleanupSecretRes.status === 200, 'Cleanup with correct secret succeeds with status 200');
    const cleanupData = await cleanupSecretRes.json();
    assert(cleanupData.success === true, 'Cleanup completed successfully');


    // 14. GET /api/retailer/settings
    console.log('\nTest 14: GET /api/retailer/settings');
    const settingsRes = await fetch(`${BASE_URL}/api/retailer/settings`);
    assert(settingsRes.status === 200, 'Settings status 200');
    const settingsData = await settingsRes.json();
    assert(settingsData.hasOwnProperty('RETAILER_BG_VERSION'), 'Settings returned RETAILER_BG_VERSION');


    // 15. DELETE /api/admin/login (admin logout / blacklist token)
    console.log('\nTest 15: DELETE /api/admin/login');
    const adminLogoutRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'DELETE',
      headers: {
        'Cookie': adminCookie
      }
    });
    assert(adminLogoutRes.status === 200, 'Admin logout status 200');
    const adminLogoutData = await adminLogoutRes.json();
    assert(adminLogoutData.success, 'Admin logged out successfully');

    // Confirm session is destroyed by attempting admin access
    const adminAccessRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      headers: { 'Cookie': adminCookie }
    });
    assert(adminAccessRes.status === 401, 'Admin token is blacklisted / unauthorized (status 401)');


    // 16. DELETE /api/salesman/login (salesman logout)
    console.log('\nTest 16: DELETE /api/salesman/login');
    const salesmanLogoutRes = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'DELETE',
      headers: {
        'Cookie': salesmanCookie
      }
    });
    assert(salesmanLogoutRes.status === 200, 'Salesman logout status 200');
    const salesmanLogoutData = await salesmanLogoutRes.json();
    assert(salesmanLogoutData.success, 'Salesman logged out successfully');


    // 17. GET /api/retailer/auth?token=... with an inactive retailer token
    console.log('\nTest 17: GET /api/retailer/auth?token=... with inactive token');
    // We deactivated testRetailerId earlier. Let's try to authenticate using its active token
    const inactiveAuthRes = await fetch(`${BASE_URL}/api/retailer/auth?token=${testRetailerToken}`);
    assert(inactiveAuthRes.status === 403, 'Inactive retailer auth returned status 403 (Forbidden)');
    const inactiveAuthHTML = await inactiveAuthRes.text();
    assert(inactiveAuthHTML.includes('Link Invalid or Expired'), 'HTML error page displayed for inactive retailer');


    // 18. GET /api/retailer/auth with missing token
    console.log('\nTest 18: GET /api/retailer/auth with missing token');
    const missingTokenRes = await fetch(`${BASE_URL}/api/retailer/auth`);
    assert(missingTokenRes.status === 400, 'Missing token returned status 400 (Bad Request)');
    const missingTokenHTML = await missingTokenRes.text();
    assert(missingTokenHTML.includes('Link Missing'), 'HTML error page displayed for missing token');


    // 19. Login Rate Limiting / Lockout (5 failures -> Lockout)
    console.log('\nTest 19: Login Rate Limiting / Lockout (5 failures -> Lockout)');
    const bruteForceUser = `brute_force_${Date.now()}`;
    for (let i = 1; i <= 5; i++) {
      const loginRes = await fetch(`${BASE_URL}/api/salesman/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: bruteForceUser, password: 'wrongpassword' })
      });
      assert(loginRes.status === 401, `Failed login attempt ${i} returns status 401`);
    }

    // 6th attempt should result in 423
    const lockedRes = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: bruteForceUser, password: 'wrongpassword' })
    });
    assert(lockedRes.status === 423, '6th attempt is blocked with status 423 (Locked)');
    const lockedData = await lockedRes.json();
    assert(lockedData.error && lockedData.error.includes('Too many failed attempts'), 'Correct lockout message returned');

  } catch (error) {
    console.error('❌ Unexpected test error:', error);
    errorsCount++;
  } finally {
    console.log('\n--- Clean up ---');
    // Reactivate and cleanup database records to leave the database clean
    try {
      // Re-authenticate admin
      const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      const adminLoginData = await adminLoginRes.json();
      const freshAdminCookie = adminLoginRes.headers.get('set-cookie').split(';')[0];

      if (testRetailerId) {
        await fetch(`${BASE_URL}/api/admin/retailer?id=${testRetailerId}`, {
          method: 'DELETE',
          headers: { 'Cookie': freshAdminCookie }
        });
        console.log(`- Cleaned up test retailer ID: ${testRetailerId}`);
      }

      if (testSalesmanId) {
        await fetch(`${BASE_URL}/api/admin/salesman?id=${testSalesmanId}`, {
          method: 'DELETE',
          headers: { 'Cookie': freshAdminCookie }
        });
        console.log(`- Cleaned up test salesman ID: ${testSalesmanId}`);
      }

      if (testSalesman2Id) {
        await fetch(`${BASE_URL}/api/admin/salesman?id=${testSalesman2Id}`, {
          method: 'DELETE',
          headers: { 'Cookie': freshAdminCookie }
        });
        console.log(`- Cleaned up test salesman 2 ID: ${testSalesman2Id}`);
      }
    } catch (e) {
      console.error('Cleanup failed:', e.message);
    }

    console.log(`\n🏁 Tests Finished with ${errorsCount} failures.`);
    process.exit(errorsCount > 0 ? 1 : 0);
  }
}

runTests();
