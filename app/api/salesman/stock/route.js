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
    const dbSalesman = await prisma.salesman.findUnique({
      where: { id: salesman.id },
      select: { canUploadStock: true }
    });
    const canUploadStock = dbSalesman ? dbSalesman.canUploadStock : false;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const search = searchParams.get('search') || '';
    const limit = 50;
    const skip = (page - 1) * limit;

    const globalSalesman = await prisma.salesman.findUnique({
      where: { username: 'admin_global' },
      select: { id: true }
    });

    const where = {
      salesmanId: { in: [salesman.id, globalSalesman?.id].filter(Boolean) },
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { mfg: { contains: search, mode: 'insensitive' } }
        ]
      } : {})
    };

    const [items, total] = await Promise.all([
      prisma.stockItem.findMany({
        where,
        select: {
          id: true,
          name: true,
          price: true,
          quantity: true,
          mfg: true,
          pack: true,
          salesmanId: true
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip
      }),
      prisma.stockItem.count({ where })
    ]);

    return NextResponse.json({
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        mfg: i.mfg,
        pack: i.pack,
        isAdminGlobal: i.salesmanId === globalSalesman?.id
      })),
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      page,
      canUploadStock
    });
  } catch (error) {
    console.error('Fetch salesman stock error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  return NextResponse.json({ error: 'Stock can only be added or modified by admin' }, { status: 403 });
}

export async function PUT(request) {
  return NextResponse.json({ error: 'Stock can only be added or modified by admin' }, { status: 403 });
}

export async function DELETE(request) {
  return NextResponse.json({ error: 'Stock can only be added or modified by admin' }, { status: 403 });
}
