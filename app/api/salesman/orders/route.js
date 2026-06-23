import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

// Helper to check salesman permission
async function checkSalesmanAuth() {
  const cookieStore = await cookies();
  return validateSession(cookieStore, 'salesman_session', 'salesman');
}

export async function GET() {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: { salesmanId: salesman.id },
      include: {
        retailer: {
          select: { shopName: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Fetch salesman orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'Order ID and status are required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.order.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing || existing.salesmanId !== salesman.id) {
      return NextResponse.json({ error: 'Forbidden or order not found' }, { status: 403 });
    }

    const upperStatus = status.toUpperCase();
    if (upperStatus !== 'PENDING' && upperStatus !== 'FULFILLED') {
      return NextResponse.json({ error: 'Invalid status value. Must be PENDING or FULFILLED' }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status: upperStatus }
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Update order status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
