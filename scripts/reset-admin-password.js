const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function reset() {
  try {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.admin.upsert({
      where: { username: 'admin' },
      update: { passwordHash },
      create: {
        username: 'admin',
        passwordHash
      }
    });
    console.log('Admin password reset successful. New admin record:', admin);
    
    // Verify comparison immediately
    const isMatch = await bcrypt.compare('admin123', admin.passwordHash);
    console.log('Does password "admin123" match the newly written hash in DB?', isMatch);
  } catch (error) {
    console.error('Error resetting admin password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
