import { NextResponse } from 'next/server';
import { cleanupOldOrders } from '@/lib/cleanup';

export async function GET(request) {
  try {
    // Optional basic auth check (e.g. check cron header or token)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const authHeaderSecret = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
    const providedSecret = secret || authHeaderSecret;

    if (!cronSecret || providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deletedCount = await cleanupOldOrders();
    return NextResponse.json({ 
      success: true, 
      message: `Cleanup completed successfully. Deleted ${deletedCount} old orders.`,
      deletedCount 
    });
  } catch (error) {
    console.error('Cleanup API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
