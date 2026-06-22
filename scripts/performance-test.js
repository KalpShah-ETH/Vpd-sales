/**
 * VPD Order System - UI & API Performance Test Suite
 * Measures the response time of pages and APIs.
 */

const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';

async function testPerformance() {
  console.log('⚡ Starting VPD Performance & Response Speed Tests...\n');

  const targets = [
    { name: 'Landing Page (/)', url: `${BASE_URL}/`, type: 'page' },
    { name: 'Admin Redirect Page (/admin/login)', url: `${BASE_URL}/admin/login`, type: 'page' },
    { name: 'Salesman Redirect Page (/salesman/login)', url: `${BASE_URL}/salesman/login`, type: 'page' },
    { name: 'Admin Login API POST (/api/admin/login)', url: `${BASE_URL}/api/admin/login`, type: 'api', method: 'POST', body: { username: 'invalid_user', password: 'wrong_password' } }
  ];

  const results = [];

  for (const target of targets) {
    console.log(`Testing ${target.name}...`);
    const times = [];
    
    // Run 5 iterations to get an average, ignoring the first one (cold start / compilation overhead)
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      try {
        const options = {
          method: target.method || 'GET',
          headers: target.method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        };
        if (target.body) {
          options.body = JSON.stringify(target.body);
        }
        
        const res = await fetch(target.url, options);
        // consume body to be accurate
        await res.text();
        
        const end = performance.now();
        times.push(end - start);
      } catch (err) {
        console.error(`Error requesting ${target.url}:`, err.message);
      }
    }

    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      results.push({
        name: target.name,
        avgMs: avg.toFixed(2),
        minMs: min.toFixed(2),
        maxMs: max.toFixed(2),
        status: avg < 200 ? '🚀 Fast' : avg < 600 ? '⏳ Average' : '⚠️ Slow'
      });
    }
  }

  console.log('\n📊 Performance Test Results (Average of 5 runs):');
  console.table(results);
}

testPerformance();
