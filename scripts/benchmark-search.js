const BASE_URL = 'http://localhost:3000';

async function runBenchmark() {
  console.log('🧪 Running Browse/Search Benchmark...');

  // 1. Admin login
  const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const setCookieHeader = adminLoginRes.headers.get('set-cookie');
  const adminCookie = setCookieHeader.split(';')[0];

  // 2. Create a temporary salesman
  const testSalesmanPhone = `9877${Math.floor(100000 + Math.random() * 900000)}`;
  const createSalesmanRes = await fetch(`${BASE_URL}/api/admin/salesman`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      name: 'Benchmark Rep',
      companyName: 'Benchmark Pharma',
      phone: testSalesmanPhone,
      username: testSalesmanPhone,
      password: 'password123'
    })
  });
  const salesmanData = await createSalesmanRes.json();
  const salesmanId = salesmanData.salesman.id;

  // 3. Salesman login to get cookie
  const salesmanLoginRes = await fetch(`${BASE_URL}/api/salesman/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testSalesmanPhone, password: 'password123' })
  });
  const salesmanCookie = salesmanLoginRes.headers.get('set-cookie').split(';')[0];

  // 4. Populate with 1000 stock items
  // 4. Populate with 100 stock items
  console.log('📦 Creating 100 stock items for benchmarking...');
  const items = [];
  for (let i = 1; i <= 100; i++) {
    items.push({
      name: `Benchmark Medicine ${i} Tab`,
      mfg: 'Benchmark Laboratories',
      pack: '10 strips',
      quantity: 100,
      price: 10.0
    });
  }

  await fetch(`${BASE_URL}/api/salesman/stock/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': salesmanCookie },
    body: JSON.stringify({ items })
  });
  console.log('✅ Created 100 items.');

  // 5. Create a retailer
  const createRetailerRes = await fetch(`${BASE_URL}/api/admin/retailer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      shopName: 'Benchmark Retailer',
      phone: `9955${Math.floor(100000 + Math.random() * 900000)}`,
      salesmanId
    })
  });
  const retailerData = await createRetailerRes.json();
  const retailerToken = retailerData.retailer.token;

  // 6. Retailer login
  const autologinRes = await fetch(`${BASE_URL}/api/retailer/auth?token=${retailerToken}`, {
    redirect: 'manual'
  });
  const retailerCookie = autologinRes.headers.get('set-cookie').split(';')[0];

  // 7. Measure request time for page 1 browse
  console.log('\n⏱️ Benchmarking GET /api/retailer/browse (10 iterations)...');
  const times = [];
  for (let iter = 1; iter <= 10; iter++) {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/api/retailer/browse?companyId=${salesmanId}&page=1&search=`, {
      headers: { 'Cookie': retailerCookie }
    });
    await res.json();
    const duration = performance.now() - start;
    times.push(duration);
    console.log(`  Iteration ${iter}: ${duration.toFixed(2)} ms`);
  }

  const average = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n📊 Average response time: ${average.toFixed(2)} ms`);

  // 8. Cleanup
  console.log('\n🧹 Cleaning up benchmark records...');
  await fetch(`${BASE_URL}/api/admin/retailer?id=${retailerData.retailer.id}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminCookie }
  });
  await fetch(`${BASE_URL}/api/admin/salesman?id=${salesmanId}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminCookie }
  });
  console.log('🏁 Benchmark complete!');
}

runBenchmark();
