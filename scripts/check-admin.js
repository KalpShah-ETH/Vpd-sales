const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    const admins = await prisma.admin.findMany();
    console.log('Admins in DB:', admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
