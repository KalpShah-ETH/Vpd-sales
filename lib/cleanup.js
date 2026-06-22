import prisma from './db';

/**
 * Deletes orders older than 7 days from the database.
 */
export async function cleanupOldOrders() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await prisma.order.deleteMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    if (result.count > 0) {
      console.log(`[Auto-Cleanup] Successfully deleted ${result.count} orders older than 7 days.`);
    }
    return result.count;
  } catch (error) {
    console.error('[Auto-Cleanup Error]:', error);
    return 0;
  }
}

// Automatically schedule cleanup check once every 24 hours in the Node process background
if (typeof window === 'undefined') {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  // Run an initial cleanup check shortly after startup
  setTimeout(() => {
    cleanupOldOrders();
  }, 10000);

  // Repeat cleanup every 24 hours
  setInterval(() => {
    cleanupOldOrders();
  }, ONE_DAY_MS);
}
