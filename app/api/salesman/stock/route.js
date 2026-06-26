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
      page
    });
  } catch (error) {
    console.error('Fetch salesman stock error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, price, quantity, mfg, pack } = await request.json();

    if (!name || quantity === undefined) {
      return NextResponse.json({ error: 'Name and quantity are required' }, { status: 400 });
    }

    const numPrice = price !== undefined && price !== '' ? parseFloat(price) : 0.0;
    const numQty = parseInt(quantity);

    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json({ error: 'Price must be a valid non-negative number' }, { status: 400 });
    }
    if (isNaN(numQty) || numQty < 0) {
      return NextResponse.json({ error: 'Quantity must be a valid non-negative integer' }, { status: 400 });
    }

    const item = await prisma.stockItem.create({
      data: {
        name: name.trim(),
        price: numPrice,
        quantity: numQty,
        mfg: mfg ? mfg.trim() : null,
        pack: pack ? pack.trim() : null,
        salesmanId: salesman.id
      }
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Create stock item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name, price, quantity, mfg, pack } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Stock item ID is required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.stockItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing || existing.salesmanId !== salesman.id) {
      return NextResponse.json({ error: 'Forbidden or item not found' }, { status: 403 });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    
    if (price !== undefined) {
      const numPrice = price !== '' ? parseFloat(price) : 0.0;
      if (isNaN(numPrice) || numPrice < 0) {
        return NextResponse.json({ error: 'Price must be a valid non-negative number' }, { status: 400 });
      }
      updateData.price = numPrice;
    }

    if (quantity !== undefined) {
      const numQty = parseInt(quantity);
      if (isNaN(numQty) || numQty < 0) {
        return NextResponse.json({ error: 'Quantity must be a valid non-negative integer' }, { status: 400 });
      }
      updateData.quantity = numQty;
    }

    if (mfg !== undefined) {
      updateData.mfg = mfg ? mfg.trim() : null;
    }

    if (pack !== undefined) {
      updateData.pack = pack ? pack.trim() : null;
    }

    const item = await prisma.stockItem.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Update stock item error:', error);
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Stock item ID is required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.stockItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing || existing.salesmanId !== salesman.id) {
      return NextResponse.json({ error: 'Forbidden or item not found' }, { status: 403 });
    }

    try {
      await prisma.stockItem.delete({
        where: { id: parseInt(id) }
      });
    } catch (dbErr) {
      if (dbErr.code !== 'P2025') {
        throw dbErr;
      }
    }

    return NextResponse.json({ success: true, message: 'Stock item deleted successfully' });
  } catch (error) {
    console.error('Delete stock item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
