import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

async function checkSalesmanAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'salesman_session', 'salesman');
}

export async function POST(request) {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items } = await request.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload: items must be an array' }, { status: 400 });
    }

    // 1. Get existing items for this salesman
    const existingItems = await prisma.stockItem.findMany({
      where: { salesmanId: salesman.id },
      select: { name: true, mfg: true, pack: true }
    });

    const getUniquenessKey = (name, mfg, pack) => {
      const cleanName = (name || '').trim().toLowerCase();
      const cleanMfg = (mfg || '').trim().toLowerCase();
      const cleanPack = (pack || '').trim().toLowerCase();
      return `${cleanName}|${cleanMfg}|${cleanPack}`;
    };

    const existingKeys = new Set(existingItems.map(item => getUniquenessKey(item.name, item.mfg, item.pack)));

    // 2. Filter new items
    const newItems = [];
    let skippedCount = 0;

    for (const item of items) {
      if (!item.name || item.quantity === undefined) {
        continue;
      }
      const uniquenessKey = getUniquenessKey(item.name, item.mfg, item.pack);

      if (existingKeys.has(uniquenessKey)) {
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
        salesmanId: salesman.id
      });
      // Add to set to prevent duplicates within the uploaded batch itself
      existingKeys.add(uniquenessKey);
    }

    // 3. Bulk insert if there are any new items
    if (newItems.length > 0) {
      await prisma.stockItem.createMany({
        data: newItems
      });
    }

    return NextResponse.json({
      success: true,
      inserted: newItems.length,
      skipped: skippedCount
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
