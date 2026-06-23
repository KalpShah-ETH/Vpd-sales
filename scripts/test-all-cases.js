/**
 * VPD Order System - Comprehensive Integration Test Suite
 * Runs against the running local development server at http://localhost:3000
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-vpd-jwt-key-change-this-in-production";

// Helper assertions
function assertEqual(val, expected, msg) {
  if (val !== expected) {
    throw new Error(`Assertion failed: ${msg}. Expected "${expected}" (type ${typeof expected}), got "${val}" (type ${typeof val})`);
  }
}

function assertContains(str, substr, msg) {
  if (!str || !str.includes(substr)) {
    throw new Error(`Assertion failed: ${msg}. Expected string containing "${substr}", got "${str}"`);
  }
}

async function runAllTests() {
  console.log('🧪 Starting VPD Order System Comprehensive Integration Tests...\n');

  // Let's retrieve existing records or setup variables to clean up later
  const createdSalesmenIds = [];
  const createdRetailersIds = [];
  const createdStockItemIds = [];
  const createdOrderIds = [];

  let adminCookie = '';
  
  try {
    // -------------------------------------------------------------
    // PREPARATION: Login Admin
    // -------------------------------------------------------------
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    if (adminLoginRes.status !== 200) {
      throw new Error('Admin login failed; please ensure the server is running and admin credentials are seeded.');
    }
    const adminSetCookieHeader = adminLoginRes.headers.get('set-cookie');
    if (!adminSetCookieHeader) {
      throw new Error('No Set-Cookie header returned in Admin Login');
    }
    adminCookie = adminSetCookieHeader.split(';')[0];
    console.log('🔑 Admin authenticated successfully.');

    // -------------------------------------------------------------
    // TEST 1: GET No Cookie (Auth Guards on Protected Routes)
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Auth Guards (No Cookie) ---');
    const protectedRoutes = [
      { path: '/api/admin/salesman', method: 'GET' },
      { path: '/api/admin/retailer', method: 'GET' },
      { path: '/api/admin/orders', method: 'GET' },
      { path: '/api/salesman/stock', method: 'GET' },
      { path: '/api/salesman/orders', method: 'GET' },
      { path: '/api/retailer/browse', method: 'GET' },
      { path: '/api/retailer/order', method: 'POST', body: {} },
      { path: '/api/salesman/stock', method: 'POST', body: {} }
    ];

    for (const route of protectedRoutes) {
      const init = { method: route.method };
      if (route.body) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(route.body);
      }
      const res = await fetch(`${BASE_URL}${route.path}`, init);
      assertEqual(res.status, 401, `${route.method} ${route.path} without cookie`);
      console.log(`✅ Passed: ${route.method} ${route.path} rejected with 401`);
    }

    // -------------------------------------------------------------
    // TEST 2: Admin Logout DELETE
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Admin Logout (DELETE /api/admin/login) ---');
    const tempAdminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const tempAdminCookie = tempAdminLoginRes.headers.get('set-cookie').split(';')[0];
    
    // Call Logout DELETE
    const logoutRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'DELETE',
      headers: { 'Cookie': tempAdminCookie }
    });
    assertEqual(logoutRes.status, 200, 'DELETE /api/admin/login status');
    
    // Try to access protected route with old cookie
    const checkRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      headers: { 'Cookie': tempAdminCookie }
    });
    assertEqual(checkRes.status, 401, 'Protected route check after logout');
    console.log('✅ Passed: Admin logout clears session and subsequent requests with old cookie return 401');

    // -------------------------------------------------------------
    // TEST 3: Salesman Logout DELETE
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Salesman Logout (DELETE /api/salesman/login) ---');
    const salesmanAPhone = `9100${Math.floor(100000 + Math.random() * 900000)}`;
    const salesmanAPass = 'passwordA123';
    
    // Create Salesman A
    const createSalesmanARes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Salesman A',
        companyName: 'Company A',
        phone: salesmanAPhone,
        password: salesmanAPass
      })
    });
    const salesmanAData = await createSalesmanARes.json();
    assertEqual(createSalesmanARes.status, 200, 'Create Salesman A status');
    const salesmanAId = salesmanAData.salesman.id;
    createdSalesmenIds.push(salesmanAId);

    // Login Salesman A
    const loginARes = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: salesmanAPhone, password: salesmanAPass })
    });
    assertEqual(loginARes.status, 200, 'Salesman A login status');
    const salesmanACookie = loginARes.headers.get('set-cookie').split(';')[0];

    // Logout Salesman A
    const logoutARes = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'DELETE',
      headers: { 'Cookie': salesmanACookie }
    });
    assertEqual(logoutARes.status, 200, 'Salesman A logout status');

    // Check with old cookie
    const checkStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      headers: { 'Cookie': salesmanACookie }
    });
    assertEqual(checkStockRes.status, 401, 'Salesman A stock access with old cookie');
    console.log('✅ Passed: Salesman logout clears session and subsequent requests return 401');

    // -------------------------------------------------------------
    // TEST 4: Salesman Login - Inactive Account
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Deactivated Salesman Login ---');
    const salesmanBPhone = `9100${Math.floor(100000 + Math.random() * 900000)}`;
    const salesmanBPass = 'passwordB123';
    
    // Create Salesman B
    const createBRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Salesman B',
        companyName: 'Company B',
        phone: salesmanBPhone,
        password: salesmanBPass
      })
    });
    const salesmanBData = await createBRes.json();
    const salesmanBId = salesmanBData.salesman.id;
    createdSalesmenIds.push(salesmanBId);

    // Deactivate Salesman B
    const deactivateBRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        id: salesmanBId,
        active: false
      })
    });
    assertEqual(deactivateBRes.status, 200, 'Deactivate Salesman B status');

    // Try to login as Salesman B
    const loginBRes = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: salesmanBPhone, password: salesmanBPass })
    });
    assertEqual(loginBRes.status, 403, 'Salesman B login status');
    const loginBData = await loginBRes.json();
    assertContains(loginBData.error, 'deactivated', 'Deactivation message');
    console.log('✅ Passed: Deactivated salesman login returns 403 with deactivation message');

    // -------------------------------------------------------------
    // TEST 5: Salesman PUT Edit updates fields in DB
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Salesman PUT Edit validation ---');
    const updatedSalesmanName = 'Salesman B Updated';
    const updatedCompanyName = 'Company B Updated';
    const updateSalesmanBRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        id: salesmanBId,
        name: updatedSalesmanName,
        companyName: updatedCompanyName,
        active: true // Reactivate B
      })
    });
    assertEqual(updateSalesmanBRes.status, 200, 'Update Salesman B status');

    // Verify GET list shows update
    const getSalesmenRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      headers: { 'Cookie': adminCookie }
    });
    const salesmenList = await getSalesmenRes.json();
    const dbSalesmanB = salesmenList.find(s => s.id === salesmanBId);
    assertEqual(dbSalesmanB.name, updatedSalesmanName, 'Salesman name');
    assertEqual(dbSalesmanB.companyName, updatedCompanyName, 'Salesman company');
    assertEqual(dbSalesmanB.active, true, 'Salesman active status');
    console.log('✅ Passed: Salesman PUT endpoint updates name, companyName, active status successfully in database');

    // -------------------------------------------------------------
    // TEST 6: Salesman Duplicate Phone Check
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Salesman Duplicate Phone creation check ---');
    const duplicateSalesmanRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        name: 'Salesman B Clone',
        companyName: 'Company B Clone',
        phone: salesmanBPhone, // Existing phone number
        password: 'somepassword'
      })
    });
    assertEqual(duplicateSalesmanRes.status, 400, 'Duplicate phone status');
    console.log('✅ Passed: Salesman duplicate phone returns 400');

    // -------------------------------------------------------------
    // TEST 7: Retailer CRUD (PUT, deactivation, token regen, shopName edit)
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Retailer CRUD & PUT endpoint check ---');
    const retailerAPhone = `9900${Math.floor(100000 + Math.random() * 900000)}`;
    const createRetailerARes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        shopName: 'Shop A',
        phone: retailerAPhone
      })
    });
    assertEqual(createRetailerARes.status, 200, 'Create Retailer A status');
    const retailerAData = await createRetailerARes.json();
    const retailerAId = retailerAData.retailer.id;
    const initialToken = retailerAData.retailer.token;
    createdRetailersIds.push(retailerAId);

    // 1. PUT shopName
    const editShopNameRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        id: retailerAId,
        shopName: 'Shop A Edited'
      })
    });
    assertEqual(editShopNameRes.status, 200, 'Edit shopName status');
    const editShopNameData = await editShopNameRes.json();
    assertEqual(editShopNameData.retailer.shopName, 'Shop A Edited', 'Shop name updated');

    // 2. PUT active: false
    const deactivateRetailerRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        id: retailerAId,
        active: false
      })
    });
    assertEqual(deactivateRetailerRes.status, 200, 'Deactivate Retailer A status');
    const deactivateRetailerData = await deactivateRetailerRes.json();
    assertEqual(deactivateRetailerData.retailer.active, false, 'Retailer active is false');

    // 3. PUT regenerateToken: true
    const regenTokenRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        id: retailerAId,
        regenerateToken: true
      })
    });
    assertEqual(regenTokenRes.status, 200, 'Regenerate token status');
    const regenTokenData = await regenTokenRes.json();
    const newToken = regenTokenData.retailer.token;
    if (initialToken === newToken) {
      throw new Error('Retailer token was not updated after regenerateToken:true');
    }

    // Reactivate Retailer A for subsequent tests
    await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        id: retailerAId,
        active: true
      })
    });

    console.log('✅ Passed: Retailer PUT endpoint updates shopName, active status, and regenerates tokens correctly');

    // -------------------------------------------------------------
    // TEST 8: Retailer Duplicate Phone Check
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Retailer Duplicate Phone Check ---');
    const duplicateRetailerRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        shopName: 'Shop A Duplicate',
        phone: retailerAPhone
      })
    });
    assertEqual(duplicateRetailerRes.status, 400, 'Duplicate phone status');
    console.log('✅ Passed: Single retailer creation with duplicate phone returns 400');

    // -------------------------------------------------------------
    // TEST 9: Retailer POST Bulk Creation
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Bulk Retailer CSV Creation ---');
    const bulkPhone1 = `9900${Math.floor(100000 + Math.random() * 900000)}`;
    const bulkPhone2 = `9900${Math.floor(100000 + Math.random() * 900000)}`;
    
    const bulkPostRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        retailers: [
          { shopName: 'Bulk Shop 1', phone: bulkPhone1 },
          { shopName: 'Bulk Shop 2', phone: bulkPhone2 },
          { shopName: 'Bulk Shop 1 Updated', phone: bulkPhone1 } // Duplicate phone
        ]
      })
    });
    
    assertEqual(bulkPostRes.status, 200, 'Bulk upload status');
    const bulkPostData = await bulkPostRes.json();
    assertEqual(bulkPostData.count, 3, 'Created/Updated count'); // 2 new, 1 update = 3 total resolved
    
    // Add bulk retailer IDs to clean up list
    for (const r of bulkPostData.results) {
      if (!createdRetailersIds.includes(r.id)) {
        createdRetailersIds.push(r.id);
      }
    }
    console.log('✅ Passed: Bulk Retailer POST handles creations, updates/duplicates, and responds with results/errors');

    // -------------------------------------------------------------
    // TEST 10: Salesman Stock CRUD & Validation
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Salesman Stock CRUD & Validation ---');
    // Login B
    const loginBRes2 = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: salesmanBPhone, password: salesmanBPass })
    });
    const salesmanBCookie = loginBRes2.headers.get('set-cookie').split(';')[0];

    // Create item
    const createStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({
        name: 'Item B1',
        price: 85.50,
        quantity: 100
      })
    });
    assertEqual(createStockRes.status, 200, 'Create stock status');
    const createStockData = await createStockRes.json();
    const stockItemId = createStockData.item.id;
    createdStockItemIds.push(stockItemId);

    // Edit item
    const editStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({
        id: stockItemId,
        price: 90.00,
        quantity: 200
      })
    });
    assertEqual(editStockRes.status, 200, 'Edit stock status');
    const editStockData = await editStockRes.json();
    assertEqual(editStockData.item.price, 90.00, 'Updated price');
    assertEqual(editStockData.item.quantity, 200, 'Updated quantity');

    // Validate bad price/quantity inputs
    const badStockRes1 = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ name: 'Bad Item 1', price: -5.00, quantity: 10 })
    });
    assertEqual(badStockRes1.status, 400, 'Negative price POST status');

    const badStockRes2 = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ name: 'Bad Item 2', price: 10.00, quantity: -10 })
    });
    assertEqual(badStockRes2.status, 400, 'Negative quantity POST status');

    const badStockRes3 = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ price: 10.00, quantity: 10 }) // Missing name
    });
    assertEqual(badStockRes3.status, 400, 'Missing name POST status');

    console.log('✅ Passed: Stock item creation/edit validations succeed, negative prices/quantities rejected');

    // -------------------------------------------------------------
    // TEST 11: Cross-Ownership on Stock Items
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Cross-Ownership on Stock Items ---');
    // Login A
    const loginARes2 = await fetch(`${BASE_URL}/api/salesman/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: salesmanAPhone, password: salesmanAPass })
    });
    const salesmanACookieRefetched = loginARes2.headers.get('set-cookie').split(';')[0];

    // Salesman A tries to edit Salesman B's stock item
    const crossEditRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanACookieRefetched },
      body: JSON.stringify({
        id: stockItemId, // Salesman B's item
        price: 99.00
      })
    });
    assertEqual(crossEditRes.status, 403, 'Cross-edit status');

    // Salesman A tries to delete Salesman B's stock item
    const crossDeleteRes = await fetch(`${BASE_URL}/api/salesman/stock?id=${stockItemId}`, {
      method: 'DELETE',
      headers: { 'Cookie': salesmanACookieRefetched }
    });
    assertEqual(crossDeleteRes.status, 403, 'Cross-delete status');

    console.log('✅ Passed: Salesman A editing/deleting Salesman B\'s stock returns 403 Forbidden');

    // -------------------------------------------------------------
    // TEST 12: Retailer Autologin Token Scenarios
    // -------------------------------------------------------------
    console.log('\n--- Test 12: Retailer Private Link Token Scenarios ---');
    // Test 12.1: Bad Token
    const badTokenRes = await fetch(`${BASE_URL}/api/retailer/auth?token=deadbeef`);
    assertEqual(badTokenRes.status, 403, 'Auth with bad token status');
    const badTokenHTML = await badTokenRes.text();
    assertContains(badTokenHTML, 'Link Invalid or Expired', 'Bad token error page content');

    // Test 12.2: Missing Token Param
    const missingTokenRes = await fetch(`${BASE_URL}/api/retailer/auth`);
    assertEqual(missingTokenRes.status, 400, 'Auth with missing token status');
    const missingTokenHTML = await missingTokenRes.text();
    assertContains(missingTokenHTML, 'Link Missing', 'Missing token error page content');

    // Test 12.3: Deactivated Retailer Token
    // Deactivate Retailer A
    await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: retailerAId, active: false })
    });
    
    // Hit active token of deactivated retailer
    const deactivatedAuthRes = await fetch(`${BASE_URL}/api/retailer/auth?token=${newToken}`);
    assertEqual(deactivatedAuthRes.status, 403, 'Auth with deactivated retailer token status');
    const deactivatedAuthHTML = await deactivatedAuthRes.text();
    assertContains(deactivatedAuthHTML, 'Link Invalid or Expired', 'Deactivated retailer error page content');

    // Reactivate Retailer A
    await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: retailerAId, active: true })
    });

    console.log('✅ Passed: Invalid, missing, and deactivated tokens properly return error HTML and correct status codes');

    // -------------------------------------------------------------
    // TEST 13: Retailer Browse Multi-role Access
    // -------------------------------------------------------------
    console.log('\n--- Test 13: Retailer Browse Multi-role Access ---');
    // Authenticate Retailer A
    const retailerAuthRes = await fetch(`${BASE_URL}/api/retailer/auth?token=${newToken}`, { redirect: 'manual' });
    const retailerCookie = retailerAuthRes.headers.get('set-cookie').split(';')[0];

    // Retailer Browse with Retailer Cookie
    const browseRetailerRes = await fetch(`${BASE_URL}/api/retailer/browse`, { headers: { 'Cookie': retailerCookie } });
    assertEqual(browseRetailerRes.status, 200, 'Retailer browse status with retailer cookie');

    // Retailer Browse with Salesman Cookie
    const browseSalesmanRes = await fetch(`${BASE_URL}/api/retailer/browse`, { headers: { 'Cookie': salesmanBCookie } });
    assertEqual(browseSalesmanRes.status, 200, 'Retailer browse status with salesman cookie');

    // Retailer Browse with Admin Cookie
    const browseAdminRes = await fetch(`${BASE_URL}/api/retailer/browse`, { headers: { 'Cookie': adminCookie } });
    assertEqual(browseAdminRes.status, 200, 'Retailer browse status with admin cookie');

    console.log('✅ Passed: Multi-role catalog access (retailer, salesman, admin) verified');

    // -------------------------------------------------------------
    // TEST 14: Retailer Ordering Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- Test 14: Retailer Ordering Edge Cases ---');
    
    // 14.1: Negative quantity
    const orderNegRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId, quantity: -5 })
    });
    assertEqual(orderNegRes.status, 400, 'Negative order quantity status');

    // 14.2: Zero quantity
    const orderZeroRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId, quantity: 0 })
    });
    assertEqual(orderZeroRes.status, 400, 'Zero order quantity status');

    // 14.3: Out of stock ordering (quantity: 0 in DB)
    // Create a 0 quantity item
    const zeroStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ name: 'Zero Stock Item', price: 10.0, quantity: 0 })
    });
    const zeroStockItem = await zeroStockRes.json();
    const zeroStockId = zeroStockItem.item.id;
    createdStockItemIds.push(zeroStockId);

    const orderOutRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId: zeroStockId, quantity: 5 })
    });
    assertEqual(orderOutRes.status, 400, 'Order out of stock item status');

    // 14.4: Deactivated Retailer places order
    // Deactivate Retailer A
    await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: retailerAId, active: false })
    });
    const orderDeactivatedRetailerRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId, quantity: 10 })
    });
    assertEqual(orderDeactivatedRetailerRes.status, 403, 'Order by deactivated retailer status');
    
    // Reactivate Retailer A
    await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: retailerAId, active: true })
    });

    // 14.5: Ordering from a deactivated salesman's catalogue
    // Deactivate Salesman B (owner of stockItemId)
    await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: salesmanBId, active: false })
    });
    const orderDeactivatedSalesmanRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId, quantity: 10 })
    });
    assertEqual(orderDeactivatedSalesmanRes.status, 404, 'Order from deactivated salesman status');
    
    // Reactivate Salesman B
    await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: salesmanBId, active: true })
    });

    // 14.6: Capping behavior: Ordering more than available stock
    // Currently item stockItemId has quantity 200. Let's create an item with qty 3.
    const qty3StockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ name: 'Capping Stock Item', price: 10.0, quantity: 3 })
    });
    const qty3StockItem = await qty3StockRes.json();
    const qty3StockId = qty3StockItem.item.id;
    createdStockItemIds.push(qty3StockId);

    // Order 10
    const orderCapRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId: qty3StockId, quantity: 10 })
    });
    assertEqual(orderCapRes.status, 200, 'Order cap status');
    const orderCapData = await orderCapRes.json();
    createdOrderIds.push(orderCapData.orderId);

    // Verify quantity ordered is capped at 3
    const capOrderFromDb = await prisma.order.findUnique({ where: { id: orderCapData.orderId } });
    assertEqual(capOrderFromDb.quantity, 3, 'Order capped quantity');
    
    // Verify stock is 0
    const capStockFromDb = await prisma.stockItem.findUnique({ where: { id: qty3StockId } });
    assertEqual(capStockFromDb.quantity, 0, 'Capped stock quantity');

    console.log('✅ Passed: Ordering edge cases, deactivated/out-of-stock guards, and capping behavior verified');

    // -------------------------------------------------------------
    // TEST 15: WhatsApp Link Phone Normalization
    // -------------------------------------------------------------
    console.log('\n--- Test 15: WhatsApp Link Phone Normalization ---');
    // Case 15.1: 10-digit number (e.g. "9876543210")
    await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: salesmanBId, phone: '9876543210' })
    });
    // Create new stock item
    const itemNormRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ name: 'Normalize Item', price: 10.0, quantity: 10 })
    });
    const itemNorm = await itemNormRes.json();
    const itemNormId = itemNorm.item.id;
    createdStockItemIds.push(itemNormId);

    const orderNormRes = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId: itemNormId, quantity: 1 })
    });
    const orderNormData = await orderNormRes.json();
    createdOrderIds.push(orderNormData.orderId);
    assertContains(orderNormData.waUrl, 'wa.me/919876543210', 'Normalized 10-digit phone number in WA URL');

    // Case 15.2: Already starts with 91 (e.g. "919876543210")
    await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: salesmanBId, phone: '919876543210' })
    });
    const orderNormRes2 = await fetch(`${BASE_URL}/api/retailer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
      body: JSON.stringify({ stockItemId: itemNormId, quantity: 1 })
    });
    const orderNormData2 = await orderNormRes2.json();
    createdOrderIds.push(orderNormData2.orderId);
    assertContains(orderNormData2.waUrl, 'wa.me/919876543210', 'Already normalized phone number in WA URL');
    if (orderNormData2.waUrl.includes('wa.me/9191')) {
      throw new Error('Double 91 prefix detected in normalized WhatsApp link!');
    }

    console.log('✅ Passed: WhatsApp wa.me link generated with correctly normalized phone numbers (without double 91)');

    // -------------------------------------------------------------
    // TEST 16: Salesman Orders Status Validation & Cross-Ownership
    // -------------------------------------------------------------
    console.log('\n--- Test 16: Salesman Orders Cross-Ownership & Status Validation ---');
    const orderId = orderNormData2.orderId;

    // 16.1: Cross-ownership PUT order status
    // Salesman A tries to update Salesman B's order
    const crossOrderPutRes = await fetch(`${BASE_URL}/api/salesman/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanACookieRefetched },
      body: JSON.stringify({ id: orderId, status: 'FULFILLED' })
    });
    assertEqual(crossOrderPutRes.status, 403, 'Cross order update status');

    // 16.2: Invalid status value
    // Salesman B updates with "GIBBERISH"
    const invalidStatusRes = await fetch(`${BASE_URL}/api/salesman/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ id: orderId, status: 'GIBBERISH' })
    });
    assertEqual(invalidStatusRes.status, 400, 'Invalid order status PUT response');

    // 16.3: Valid status value
    const validStatusRes = await fetch(`${BASE_URL}/api/salesman/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ id: orderId, status: 'FULFILLED' })
    });
    assertEqual(validStatusRes.status, 200, 'Valid status update response');
    const validStatusData = await validStatusRes.json();
    assertEqual(validStatusData.order.status, 'FULFILLED', 'Order status updated in DB');

    console.log('✅ Passed: Salesman orders cross-ownership and status updates are validated and secured');

    // -------------------------------------------------------------
    // TEST 17: Token Security & JWT Tampering
    // -------------------------------------------------------------
    console.log('\n--- Test 17: Token Security & JWT Tampering ---');
    // Tampered session cookie with modified role
    const tamperedToken = jwt.sign({ role: 'admin', id: 9999 }, 'wrong-secret');
    const tamperedRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      headers: { 'Cookie': `admin_session=${tamperedToken}` }
    });
    assertEqual(tamperedRes.status, 401, 'Access with tampered JWT status');
    console.log('✅ Passed: Tampered JWT cookie is properly rejected with 401');

    // -------------------------------------------------------------
    // TEST 18: Cron Cleanup Route
    // -------------------------------------------------------------
    console.log('\n--- Test 18: Cron Cleanup Route ---');
    // Seed an order with createdAt set to 8 days ago in DB
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const oldOrder = await prisma.order.create({
      data: {
        retailerId: retailerAId,
        salesmanId: salesmanBId,
        productName: 'Aspirin Old',
        quantity: 50,
        price: 1.50,
        status: 'FULFILLED',
        createdAt: eightDaysAgo
      }
    });
    createdOrderIds.push(oldOrder.id);

    // Call GET /api/cron/cleanup. Since CRON_SECRET is not configured in env, we expect successful clean of old orders.
    const cleanupRes = await fetch(`${BASE_URL}/api/cron/cleanup`);
    assertEqual(cleanupRes.status, 200, 'Cron cleanup status');
    const cleanupData = await cleanupRes.json();
    assertEqual(cleanupData.success, true, 'Cron success response');
    
    // Check if the order is gone from DB
    const deletedOrderCheck = await prisma.order.findUnique({ where: { id: oldOrder.id } });
    assertEqual(deletedOrderCheck, null, 'Deleted old order exists in DB');
    console.log(`✅ Passed: Cron cleanup runs successfully and deletedCount reflects removed stale orders`);

    // -------------------------------------------------------------
    // TEST 19: Concurrent Order Placement (Race Condition)
    // -------------------------------------------------------------
    console.log('\n--- Test 19: Concurrent Order Placement (Race Condition) ---');
    // Create stock item with quantity: 1
    const raceStockRes = await fetch(`${BASE_URL}/api/salesman/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ name: 'Race Condition Item', price: 50.0, quantity: 1 })
    });
    const raceStockData = await raceStockRes.json();
    const raceStockId = raceStockData.item.id;
    createdStockItemIds.push(raceStockId);

    // Fire two simultaneous order requests
    console.log('Sending two concurrent order requests for the last 1 stock item...');
    const orderPromises = [
      fetch(`${BASE_URL}/api/retailer/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
        body: JSON.stringify({ stockItemId: raceStockId, quantity: 1 })
      }),
      fetch(`${BASE_URL}/api/retailer/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': retailerCookie },
        body: JSON.stringify({ stockItemId: raceStockId, quantity: 1 })
      })
    ];

    const results = await Promise.all(orderPromises);
    const statuses = results.map(r => r.status);
    console.log(`Concurrent request statuses: ${statuses.join(', ')}`);

    // Assert that one request returns 200 and the other returns 400
    const successCount = statuses.filter(s => s === 200).length;
    const failureCount = statuses.filter(s => s === 400).length;

    assertEqual(successCount, 1, 'Number of successful order updates');
    assertEqual(failureCount, 1, 'Number of failed order updates due to out-of-stock');

    // Verify stock is exactly 0
    const finalStock = await prisma.stockItem.findUnique({ where: { id: raceStockId } });
    assertEqual(finalStock.quantity, 0, 'Final stock quantity after concurrent purchases');
    console.log('✅ Passed: Race condition prevented; only one request succeeded, and final stock is 0 (not -1)');

    // -------------------------------------------------------------
    // TEST 20: Missing Field Bad Requests (POST/PUT Missing Fields)
    // -------------------------------------------------------------
    console.log('\n--- Test 20: Missing/Empty Body Bad Requests ---');
    // POST /api/admin/salesman missing fields
    const badSalesmanPostRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({})
    });
    assertEqual(badSalesmanPostRes.status, 400, 'POST /api/admin/salesman empty body');

    // POST /api/admin/login empty body
    const badAdminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assertEqual(badAdminLoginRes.status, 400, 'POST /api/admin/login empty body');

    // POST /api/admin/retailer missing shopName/phone
    const badRetailerPostRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ shopName: 'Shop' })
    });
    assertEqual(badRetailerPostRes.status, 400, 'POST /api/admin/retailer missing phone');

    // PUT /api/salesman/orders missing id/status
    const badOrderPutRes = await fetch(`${BASE_URL}/api/salesman/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesmanBCookie },
      body: JSON.stringify({ status: 'FULFILLED' })
    });
    assertEqual(badOrderPutRes.status, 400, 'PUT /api/salesman/orders missing id');

    console.log('✅ Passed: Missing/Empty bodies return 400 Bad Request across endpoints');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log('\n🧹 Cleaning up test records from database...');
    
    // Cleanup orders
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } }
      });
      console.log(`- Deleted ${createdOrderIds.length} orders`);
    }

    // Cleanup stock items
    if (createdStockItemIds.length > 0) {
      await prisma.stockItem.deleteMany({
        where: { id: { in: createdStockItemIds } }
      });
      console.log(`- Deleted ${createdStockItemIds.length} stock items`);
    }

    // Cleanup retailers
    if (createdRetailersIds.length > 0) {
      await prisma.retailer.deleteMany({
        where: { id: { in: createdRetailersIds } }
      });
      console.log(`- Deleted ${createdRetailersIds.length} retailers`);
    }

    // Cleanup salesmen
    if (createdSalesmenIds.length > 0) {
      await prisma.salesman.deleteMany({
        where: { id: { in: createdSalesmenIds } }
      });
      console.log(`- Deleted ${createdSalesmenIds.length} salesmen`);
    }

    console.log('\n🏁 Tests complete!');
    process.exit(0);
  }
}

runAllTests();
