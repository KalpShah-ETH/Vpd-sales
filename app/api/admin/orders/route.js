import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

// Helper to check admin permission
async function checkAdminAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'admin_session', 'admin');
}

export async function GET(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const [orders, total, pendingCount, fulfilledCount] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          retailer: {
            select: { shopName: true, phone: true }
          },
          salesman: {
            select: { companyName: true, name: true }
          }
        },
        take: limit,
        skip
      }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'FULFILLED' } })
    ]);

    return NextResponse.json({
      orders,
      total,
      pendingCount,
      fulfilledCount,
      totalPages: Math.ceil(total / limit),
      page
    });
  } catch (error) {
    console.error('Fetch admin orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
