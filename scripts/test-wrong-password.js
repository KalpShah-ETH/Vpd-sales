const BASE_URL = 'http://localhost:3000';

async function test() {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

test();
