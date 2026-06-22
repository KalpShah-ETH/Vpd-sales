import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';
import { cleanupOldOrders } from '@/lib/cleanup';

// Helper to check admin permission
async function checkAdminAuth() {
  const cookieStore = await cookies();
  return validateSession(cookieStore, 'admin_session', 'admin');
}

export async function GET() {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Trigger cleanup silently in the background
    cleanupOldOrders().catch(err => console.error('Silent cleanup err:', err));

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        retailer: {
          select: { shopName: true, phone: true }
        },
        salesman: {
          select: { companyName: true, name: true }
        }
      }
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Fetch admin orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
