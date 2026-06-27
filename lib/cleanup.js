import prisma from './db';

/**
 * Deletes orders older than 2 days from the database.
 */
export async function cleanupOldOrders() {
  try {
    const key = 'last_cleanup_time';
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    
    // Check last run time from DB
    const lastRunSetting = await prisma.setting.findUnique({
      where: { key }
    });
    
    if (lastRunSetting) {
      const lastRun = parseInt(lastRunSetting.value, 10);
      if (!isNaN(lastRun) && (Date.now() - lastRun) < ONE_DAY_MS) {
        // Less than 24 hours since last cleanup, skip
        return 0;
      }
    }

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const result = await prisma.order.deleteMany({
      where: {
        createdAt: {
          lt: twoDaysAgo,
        },
      },
    });

    // Update/upsert last run time
    await prisma.setting.upsert({
      where: { key },
      update: { value: Date.now().toString() },
      create: { key, value: Date.now().toString() }
    });

    if (result.count > 0) {
      console.log(`[Auto-Cleanup] Successfully deleted ${result.count} orders older than 2 days.`);
    }
    return result.count;
  } catch (error) {
    console.error('[Auto-Cleanup Error]:', error);
    return 0;
  }
}


