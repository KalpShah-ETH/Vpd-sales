const fs = require('fs');
const path = require('path');

// Manually load env variables from .env
const dotenvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(dotenvPath)) {
  const envConfig = fs.readFileSync(dotenvPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
      if (key && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  }
}

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function runProfile() {
  console.log('=== LOGGING OPERATIONAL TIME PROFILE ===');
  
  const prisma = new PrismaClient();
  
  // 1. Measure DB Query Time (Cold vs Warm)
  const t0 = Date.now();
  await prisma.admin.findFirst();
  const t1 = Date.now();
  console.log(`First DB query (Cold): ${t1 - t0}ms`);

  const t2 = Date.now();
  await prisma.admin.findFirst();
  const t3 = Date.now();
  console.log(`Second DB query (Warm): ${t3 - t2}ms`);

  // 2. Measure Bcrypt Compare Time
  const testPassword = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(testPassword, salt);
  
  console.log('\nRunning Bcrypt comparison timing...');
  const tb0 = Date.now();
  const isMatch = await bcrypt.compare(testPassword, hash);
  const tb1 = Date.now();
  console.log(`Bcrypt compare took: ${tb1 - tb0}ms`);
  
  await prisma.$disconnect();
}

runProfile().catch(console.error);
