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
    const stockItems = await prisma.stockItem.findMany({
      where: { salesmanId: salesman.id },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(stockItems);
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
    const { name, price, quantity } = await request.json();

    if (!name || price === undefined || quantity === undefined) {
      return NextResponse.json({ error: 'Name, price, and quantity are required' }, { status: 400 });
    }

    const item = await prisma.stockItem.create({
      data: {
        name: name.trim(),
        price: parseFloat(price),
        quantity: parseInt(quantity),
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
    const { id, name, price, quantity } = await request.json();

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
    if (price !== undefined) updateData.price = parseFloat(price);
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);

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

    await prisma.stockItem.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true, message: 'Stock item deleted successfully' });
  } catch (error) {
    console.error('Delete stock item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
