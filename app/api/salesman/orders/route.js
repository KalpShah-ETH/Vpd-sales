import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

// Helper to check salesman permission
async function checkSalesmanAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'salesman_session', 'salesman');
}

export async function GET(request) {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;
    
    const whereClause = { salesmanId: salesman.id };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          retailer: {
            select: { shopName: true, phone: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      prisma.order.count({ where: whereClause })
    ]);

    return NextResponse.json({
      orders,
      total,
      totalPages: Math.ceil(total / limit),
      page
    });
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

export async function DELETE(request) {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'ALL' or 'FULFILLED'

    const whereClause = {
      salesmanId: salesman.id
    };

    // By default, only delete fulfilled orders unless 'ALL' is specified,
    // but based on the prompt, it seems they want fulfilled orders deleted.
    if (filter === 'FULFILLED') {
      whereClause.status = 'FULFILLED';
    } else {
      // If no valid filter provided, let's default to deleting fulfilled
      whereClause.status = 'FULFILLED';
    }

    const result = await prisma.order.deleteMany({
      where: whereClause
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Delete orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
