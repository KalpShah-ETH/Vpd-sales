import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'admin_session', 'admin');
}

export async function POST(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items } = await request.json();
    
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload: items must be an array' }, { status: 400 });
    }

    // Get or create the special admin_global salesman
    let globalSalesman = await prisma.salesman.findUnique({
      where: { username: 'admin_global' }
    });

    if (!globalSalesman) {
      const dummyHash = await bcrypt.hash('admin_global_dummy_password_2026', 10);
      globalSalesman = await prisma.salesman.create({
        data: {
          name: 'Admin Shared Stock',
          companyName: 'Admin Shared Stock',
          phone: '0000000000',
          username: 'admin_global',
          passwordHash: dummyHash,
          active: false // keep it inactive so it is not listed as a standalone company
        }
      });
    }

    // 1. Delete all existing global stock items
    await prisma.stockItem.deleteMany({
      where: { salesmanId: globalSalesman.id }
    });

    const getUniquenessKey = (name, mfg, pack) => {
      const cleanName = (name || '').trim().toLowerCase();
      const cleanMfg = (mfg || '').trim().toLowerCase();
      const cleanPack = (pack || '').trim().toLowerCase();
      return `${cleanName}|${cleanMfg}|${cleanPack}`;
    };

    const currentKeys = new Set();

    // 2. Filter new items
    const newItems = [];
    let skippedCount = 0;

    for (const item of items) {
      if (!item.name || item.quantity === undefined) {
        continue;
      }
      const uniquenessKey = getUniquenessKey(item.name, item.mfg, item.pack);

      if (currentKeys.has(uniquenessKey)) {
        skippedCount++;
        continue;
      }

      const numPrice = item.price !== undefined && item.price !== '' ? parseFloat(item.price) : 0.0;
      const numQty = parseInt(item.quantity);

      if (isNaN(numPrice) || numPrice < 0 || isNaN(numQty) || numQty < 0) {
        continue; // Skip invalid items
      }

      newItems.push({
        name: item.name.trim(),
        price: numPrice,
        quantity: numQty,
        mfg: item.mfg ? item.mfg.trim() : null,
        pack: item.pack ? item.pack.trim() : null,
        salesmanId: globalSalesman.id
      });
      currentKeys.add(uniquenessKey);
    }

    // 3. Bulk insert for admin_global
    if (newItems.length > 0) {
      await prisma.stockItem.createMany({
        data: newItems
      });
    }

    return NextResponse.json({
      success: true,
      inserted: newItems.length,
      skipped: skippedCount,
      salesmenCount: 1
    });

  } catch (error) {
    console.error('Admin global stock upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

