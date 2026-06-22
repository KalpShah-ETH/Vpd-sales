const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';

async function verifyAdminLogin() {
  console.log('🧪 Verifying Admin Login Endpoint...');
  const start = performance.now();

  try {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    const duration = (performance.now() - start).toFixed(2);
    console.log(`- Request status: ${res.status}`);
    
    const data = await res.json();
    console.log('- Response data:', JSON.stringify(data));

    if (res.status === 200 && data.success) {
      console.log(`✅ Success! Admin login endpoint is working perfectly (${duration}ms).`);
    } else {
      console.error(`❌ Failed! Expected status 200 and success: true, got status ${res.status}.`);
    }
  } catch (error) {
    console.error('❌ Network error connecting to dev server:', error.message);
  }
}

verifyAdminLogin();
