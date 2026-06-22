const { PrismaClient } = require('@prisma/client');

// Use the pooled DATABASE_URL from .env
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function test() {
  try {
    console.log('Connecting to pooler database using:', process.env.DATABASE_URL ? 'Loaded' : 'Not Loaded');
    const count = await prisma.admin.count();
    console.log('✅ Connected successfully! Admin count:', count);
  } catch (error) {
    console.error('❌ Database connection failed using pooler:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
