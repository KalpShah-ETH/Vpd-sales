const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Create or update admin to ensure default credentials work
  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { passwordHash: passwordHash },
    create: {
      username: adminUsername,
      passwordHash: passwordHash,
    },
  });
  console.log(`Default admin configured/updated: username: '${adminUsername}', password: '${adminPassword}'`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
