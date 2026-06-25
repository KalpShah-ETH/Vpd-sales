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

    const getUniquenessKey = (name, mfg, pack) => {
      const cleanName = (name || '').trim().toLowerCase();
      const cleanMfg = (mfg || '').trim().toLowerCase();
      const cleanPack = (pack || '').trim().toLowerCase();
      return `${cleanName}|${cleanMfg}|${cleanPack}`;
    };

    // 1. Get existing items for this salesman
    const ownItems = await prisma.stockItem.findMany({
      where: { salesmanId: salesman.id }
    });

    const ownMap = new Map();
    for (const item of ownItems) {
      ownMap.set(getUniquenessKey(item.name, item.mfg, item.pack), item);
    }

    // 2. Get global items
    const globalSalesman = await prisma.salesman.findUnique({
      where: { username: 'admin_global' }
    });
    const globalItems = globalSalesman ? await prisma.stockItem.findMany({
      where: { salesmanId: globalSalesman.id }
    }) : [];

    const globalMap = new Map();
    for (const item of globalItems) {
      globalMap.set(getUniquenessKey(item.name, item.mfg, item.pack), item);
    }

    // 3. Filter and process
    const newItems = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      if (!item.name || item.quantity === undefined) {
        continue;
      }
      const key = getUniquenessKey(item.name, item.mfg, item.pack);
      const numPrice = item.price !== undefined && item.price !== '' ? parseFloat(item.price) : 0.0;
      const numQty = parseInt(item.quantity);

      if (isNaN(numPrice) || numPrice < 0 || isNaN(numQty) || numQty < 0) {
        continue; // Skip invalid items
      }

      // Case A: Salesman already has their own entry
      if (ownMap.has(key)) {
        const existingOwnItem = ownMap.get(key);
        if (existingOwnItem.quantity !== numQty) {
          await prisma.stockItem.update({
            where: { id: existingOwnItem.id },
            data: { quantity: numQty, price: numPrice }
          });
          updatedCount++;
          ownMap.set(key, { ...existingOwnItem, quantity: numQty }); // update locally
        } else {
          skippedCount++;
        }
      }
      // Case B: Global item exists but salesman doesn't have their own entry
      else if (globalMap.has(key)) {
        const existingGlobalItem = globalMap.get(key);
        if (existingGlobalItem.quantity !== numQty) {
          // Create salesman's own entry to override it
          newItems.push({
            name: item.name.trim(),
            price: numPrice,
            quantity: numQty,
            mfg: item.mfg ? item.mfg.trim() : null,
            pack: item.pack ? item.pack.trim() : null,
            salesmanId: salesman.id
          });
          ownMap.set(key, { quantity: numQty }); // track to prevent duplicates in batch
          updatedCount++;
        } else {
          skippedCount++;
        }
      }
      // Case C: Neither own nor global exists
      else {
        newItems.push({
          name: item.name.trim(),
          price: numPrice,
          quantity: numQty,
          mfg: item.mfg ? item.mfg.trim() : null,
          pack: item.pack ? item.pack.trim() : null,
          salesmanId: salesman.id
        });
        ownMap.set(key, { quantity: numQty }); // track to prevent duplicates in batch
      }
    }

    // 4. Bulk insert if there are any new items
    if (newItems.length > 0) {
      await prisma.stockItem.createMany({
        data: newItems
      });
    }

    return NextResponse.json({
      success: true,
      inserted: newItems.length,
      updated: updatedCount,
      skipped: skippedCount
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
