/**
 * VPD Order System - Automated Integration Test Suite
 * Runs against the running local development server at http://localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting VPD Order System Integration Tests...\n');

  let adminCookie = '';
  let salesmanCookie = '';
  let retailerCookie = '';
  
  let testSalesmanId = null;
  let testRetailerId = null;
  let testRetailerToken = null;
  let testStockItemId = null;
  let testOrderId = null;

  const testSalesmanUsername = '9876543210';
  const testSalesmanPassword = 'password123';
  const testRetailerPhone = `9900${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    // -------------------------------------------------------------
    // TEST 1: Admin Login (Auth)
    // -------------------------------------------------------------
    console.log('Test 1: Admin Authentication...');
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    if (adminLoginRes.status !== 200) {
      throw new Error(`Admin login failed with status ${adminLoginRes.status}`);
    }

    const adminLoginData = await adminLoginRes.json();
    if (!adminLoginData.success) {
      throw new Error('Admin login API returned success = false');
    }

    // Extract the admin cookie
    const setCookieHeader = adminLoginRes.headers.get('set-cookie');
    if (!setCookieHeader) {
      throw new Error('No Set-Cookie header returned in Admin Login');
    }
    adminCookie = setCookieHeader.split(';')[0];
    console.log('✅ Admin authenticated successfully!\n');

    // -------------------------------------------------------------
    // TEST 2: Admin Salesman CRUD
    // -------------------------------------------------------------
    console.log('Test 2: Admin Salesman CRUD...');
    const createSalesmanRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        name: 'Test Sales Rep',
        companyName: 'Test Pharma Co',
        phone: '9876543210',
        username: testSalesmanUsername,
        password: testSalesmanPassword
      })
    });

    const createSalesmanData = await createSalesmanRes.json();
    if (!createSalesmanData.success) {
      throw new Error(`Salesman creation failed: ${createSalesmanData.error}`);
    }

    testSalesmanId = createSalesmanData.salesman.id;
    console.log(`- Created salesman ID: ${testSalesmanId}`);

    // Read list to confirm
    const getSalesmenRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      headers: { 'Cookie': adminCookie }
    });
    const salesmenList = await getSalesmenRes.json();
    const foundSalesman = salesmenList.find(s => s.id === testSalesmanId);
    if (!foundSalesman) {
      throw new Error('Salesman not found in the list after creation');
    }
    console.log('✅ Salesman CRUD verified successfully!\n');

    // -------------------------------------------------------------
    // TEST 3: Admin Retailer CRUD & Token Generation
    // -------------------------------------------------------------
    console.log('Test 3: Admin Retailer Link & Token Gen...');
    const createRetailerRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        shopName: 'Test Medical Shop',
        phone: testRetailerPhone
      })
    });

    const createRetailerData = await createRetailerRes.json();
    if (!createRetailerData.success) {
      throw new Error(`Retailer creation failed: ${createRetailerData.error}`);
    }

    testRetailerId = createRetailerData.retailer.id;
    testRetailerToken = createRetailerData.retailer.token;
    console.log(`- Created Retailer ID: ${testRetailerId}`);
    console.log(`- Generated Access Token: ${testRetailerToken}`);
    console.log(`- Access Link: ${BASE_URL}/r/${testRetailerToken}`);
    console.log('✅ Retailer link setup verified!\n');

    // -------------------------------------------------------------
    // TEST 4: Salesman Login
    // -------------------------------------------------------------
    console.log('Test 4: Salesman Authentication...');
    const salesmanLoginRes = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testSalesmanUsername, password: testSalesmanPassword })
    });

    if (salesmanLoginRes.status !== 200) {
      throw new Error(`Salesman login failed with status ${salesmanLoginRes.status}`);
    }

    const salesmanCookieHeader = salesmanLoginRes.headers.get('set-cookie');
    if (!salesmanCookieHeader) {
      throw new Error('No Set-Cookie header returned in Salesman Login');
    }
    salesmanCookie = salesmanCookieHeader.split(';')[0];
    console.log('✅ Salesman authenticated successfully!\n');

    // -------------------------------------------------------------
    // TEST 5: Salesman Stock Catalogue Management
    // -------------------------------------------------------------
    console.log('Test 5: Salesman Stock Creation...');
    const createStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': salesmanCookie
      },
      body: JSON.stringify({
        name: 'Test Aspirin 100mg',
        price: 85.50,
        quantity: 100
      })
    });

    const createStockData = await createStockRes.json();
    if (!createStockData.success) {
      throw new Error(`Stock item creation failed: ${createStockData.error}`);
    }

    testStockItemId = createStockData.item.id;
    console.log(`- Created Stock Item ID: ${testStockItemId}`);
    
    // Read and verify item
    const getStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      headers: { 'Cookie': salesmanCookie }
    });
    const stockList = await getStockRes.json();
    const foundItem = stockList.find(i => i.id === testStockItemId);
    if (!foundItem || foundItem.quantity !== 100) {
      throw new Error('Stock item details mismatch in query');
    }
    console.log('✅ Salesman Catalogue verified!\n');

    // -------------------------------------------------------------
    // TEST 6: Retailer Autologin Redirection
    // -------------------------------------------------------------
    console.log('Test 6: Retailer Private Link Resolve...');
    // Requesting the token API redirect
    const autologinRes = await fetch(`${BASE_URL}/api/retailer/auth?token=${testRetailerToken}`, {
      redirect: 'manual' // Prevent following redirect so we can read headers
    });

    if (autologinRes.status !== 307 && autologinRes.status !== 302) {
      throw new Error(`Autologin failed with status ${autologinRes.status}`);
    }

    const retailerCookieHeader = autologinRes.headers.get('set-cookie');
    if (!retailerCookieHeader) {
      throw new Error('No Set-Cookie header returned in Retailer Autologin');
    }
    retailerCookie = retailerCookieHeader.split(';')[0];
    console.log('✅ Retailer autologin & session cookie verified!\n');

    // -------------------------------------------------------------
    // TEST 7: Retailer Browsing Catalog
    // -------------------------------------------------------------
    console.log('Test 7: Retailer Catalog Browsing...');
    const browseRes = await fetch(`${BASE_URL}/api/retailer/browse`, {
      headers: { 'Cookie': retailerCookie }
    });

    if (browseRes.status !== 200) {
      throw new Error(`Browse catalog failed with status ${browseRes.status}`);
    }

    const catalogData = await browseRes.json();
    // Look for our test company
    const testCompany = catalogData.find(c => c.companyName === 'Test Pharma Co');
    if (!testCompany) {
      throw new Error('Test Pharma Co is not visible in catalog browse');
    }

    const catalogItem = testCompany.stockItems.find(i => i.id === testStockItemId);
    if (!catalogItem || catalogItem.quantity !== 100) {
      throw new Error('Aspirin stock item is not visible or quantity is wrong in browse view');
    }
    console.log('✅ Retailer catalog visibility verified!\n');

    // -------------------------------------------------------------
    // TEST 8: Retailer Order Placement & WhatsApp Handoff
    // -------------------------------------------------------------
    console.log('Test 8: Retailer Order placement & WhatsApp Link generation...');
    const orderRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': retailerCookie
      },
      body: JSON.stringify({
        stockItemId: testStockItemId,
        quantity: 5
      })
    });

    if (orderRes.status !== 200) {
      throw new Error(`Order placement failed with status ${orderRes.status}`);
    }

    const orderData = await orderRes.json();
    if (!orderData.success) {
      throw new Error(`Order API returned success = false: ${orderData.error}`);
    }

    testOrderId = orderData.orderId;
    console.log(`- Order saved in database. ID: ${testOrderId}`);
    console.log(`- Generated WhatsApp Web Redirect URL:`);
    console.log(`  ${orderData.waUrl}`);
    
    // Verify stock is decremented
    const stockVerifyRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      headers: { 'Cookie': salesmanCookie }
    });
    const updatedStockList = await stockVerifyRes.json();
    const updatedItem = updatedStockList.find(i => i.id === testStockItemId);
    if (updatedItem.quantity !== 95) {
      throw new Error(`Stock quantity was not decremented. Expected 95, found ${updatedItem.quantity}`);
    }
    console.log('- Verified inventory decremented (100 -> 95).');
    console.log('✅ Retailer Order placement verified successfully!\n');

    // -------------------------------------------------------------
    // TEST 9: Salesman Order Tracking & Fulfillment
    // -------------------------------------------------------------
    console.log('Test 9: Salesman Orders Feed & Delivery Fulfillment...');
    const getOrdersRes = await fetch(`${BASE_URL}/api/salesman/orders`, {
      headers: { 'Cookie': salesmanCookie }
    });
    const ordersList = await getOrdersRes.json();
    const foundOrder = ordersList.find(o => o.id === testOrderId);
    if (!foundOrder || foundOrder.status !== 'PENDING') {
      throw new Error('Order not found or not in PENDING state');
    }

    // Mark as FULFILLED
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

    const fulfillData = await fulfillRes.json();
    if (!fulfillData.success) {
      throw new Error(`Fulfillment API returned error: ${fulfillData.error}`);
    }

    // Verify status updated
    const getOrdersRes2 = await fetch(`${BASE_URL}/api/salesman/orders`, {
      headers: { 'Cookie': salesmanCookie }
    });
    const ordersList2 = await getOrdersRes2.json();
    const foundOrder2 = ordersList2.find(o => o.id === testOrderId);
    if (!foundOrder2 || foundOrder2.status !== 'FULFILLED') {
      throw new Error('Order status failed to update to FULFILLED');
    }
    console.log('✅ Delivery fulfillment flow verified!\n');

    // -------------------------------------------------------------
    // TEST 10: Admin Orders Dashboard & Activity Log
    // -------------------------------------------------------------
    console.log('Test 10: Admin Activity log tracking...');
    const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { 'Cookie': adminCookie }
    });
    const adminOrdersList = await adminOrdersRes.json();
    const adminFoundOrder = adminOrdersList.find(o => o.id === testOrderId);
    if (!adminFoundOrder || adminFoundOrder.status !== 'FULFILLED') {
      throw new Error('Admin orders activity feed failed to register fulfilled order');
    }
    console.log('✅ Admin orders feed tracking verified!\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Delete test salesman and retailer
    // -------------------------------------------------------------
    console.log('🧹 Cleaning up test records from database...');
    if (adminCookie) {
      if (testRetailerId) {
        await fetch(`${BASE_URL}/api/admin/retailer?id=${testRetailerId}`, {
          method: 'DELETE',
          headers: { 'Cookie': adminCookie }
        });
        console.log(`- Deleted test retailer ID ${testRetailerId}`);
      }
      if (testSalesmanId) {
        await fetch(`${BASE_URL}/api/admin/salesman?id=${testSalesmanId}`, {
          method: 'DELETE',
          headers: { 'Cookie': adminCookie }
        });
        console.log(`- Deleted test salesman ID ${testSalesmanId}`);
      }
    }
    console.log('\n🏁 Tests complete!');
  }
}

runTests();
