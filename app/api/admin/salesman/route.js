import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

// Helper to check admin permission
async function checkAdminAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'admin_session', 'admin');
}

export async function GET() {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const globalSalesman = await prisma.salesman.findUnique({
      where: { username: 'admin_global' },
      select: { id: true }
    });

    const globalItems = globalSalesman ? await prisma.stockItem.findMany({
      where: { salesmanId: globalSalesman.id },
      select: { name: true, mfg: true, pack: true }
    }) : [];

    const salesmen = await prisma.salesman.findMany({
      where: {
        username: { not: 'admin_global' }
      },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        companyName: true,
        phone: true,
        username: true,
        active: true,
        stockItems: {
          select: { name: true, mfg: true, pack: true }
        },
        _count: {
          select: { orders: true }
        }
      }
    });

    const getUniquenessKey = (name, mfg, pack) => {
      const cleanName = (name || '').trim().toLowerCase();
      const cleanMfg = (mfg || '').trim().toLowerCase();
      const cleanPack = (pack || '').trim().toLowerCase();
      return `${cleanName}|${cleanMfg}|${cleanPack}`;
    };

    const formattedSalesmen = salesmen.map(salesman => {
      const ownKeys = new Set(salesman.stockItems.map(item => getUniquenessKey(item.name, item.mfg, item.pack)));
      const activeGlobalCount = globalItems.filter(item => !ownKeys.has(getUniquenessKey(item.name, item.mfg, item.pack))).length;
      const totalStockCount = salesman.stockItems.length + activeGlobalCount;

      return {
        id: salesman.id,
        name: salesman.name,
        companyName: salesman.companyName,
        phone: salesman.phone,
        username: salesman.username,
        active: salesman.active,
        _count: {
          stockItems: totalStockCount,
          orders: salesman._count.orders
        }
      };
    });

    return NextResponse.json(formattedSalesmen);
  } catch (error) {
    console.error('Fetch salesmen error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Support Bulk Upload for Salesmen
    if (Array.isArray(body.salesmen)) {
      let count = 0;
      for (const s of body.salesmen) {
        const { name, companyName, phone, password } = s;
        if (!name || !companyName || !phone || !password) continue;
        const username = phone;

        // Skip existing
        const existing = await prisma.salesman.findUnique({
          where: { username },
        });
        if (existing) continue;

        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.salesman.create({
          data: {
            name,
            companyName,
            phone,
            username,
            passwordHash,
            active: true
          }
        });
        count++;
      }
      return NextResponse.json({ success: true, count });
    }

    const { name, companyName, phone, password } = body;
    const username = phone;

    if (!name || !companyName || !phone || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Check if phone/username already exists
    const existing = await prisma.salesman.findUnique({
      where: { username },
    });
    if (existing) {
      return NextResponse.json({ error: 'Salesman with this phone number already registered' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const salesman = await prisma.salesman.create({
      data: {
        name,
        companyName,
        phone,
        username,
        passwordHash,
        active: true
      }
    });

    return NextResponse.json({
      success: true,
      salesman: {
        id: salesman.id,
        name: salesman.name,
        companyName: salesman.companyName,
        phone: salesman.phone,
        username: salesman.username
      }
    });
  } catch (error) {
    console.error('Create salesman error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name, companyName, phone, password, active } = await request.json();
    const username = phone;

    if (!id) {
      return NextResponse.json({ error: 'Salesman ID is required' }, { status: 400 });
    }

    // Check username uniqueness if changing phone number
    if (username) {
      const existing = await prisma.salesman.findFirst({
        where: {
          username,
          id: { not: parseInt(id) }
        }
      });
      if (existing) {
        return NextResponse.json({ error: 'Salesman with this phone number already registered' }, { status: 400 });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (companyName) updateData.companyName = companyName;
    if (phone) {
      updateData.phone = phone;
      updateData.username = phone;
    }
    if (active !== undefined) updateData.active = active;
    
    if (password && password.trim() !== '') {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const salesman = await prisma.salesman.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return NextResponse.json({ success: true, salesman });
  } catch (error) {
    console.error('Update salesman error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Salesman ID is required' }, { status: 400 });
    }

    try {
      await prisma.salesman.delete({
        where: { id: parseInt(id) }
      });
    } catch (dbErr) {
      if (dbErr.code !== 'P2025') {
        throw dbErr;
      }
    }

    return NextResponse.json({ success: true, message: 'Salesman deleted successfully' });
  } catch (error) {
    console.error('Delete salesman error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
