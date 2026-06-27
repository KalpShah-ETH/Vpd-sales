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
    // 1. Check database permission
    const dbSalesman = await prisma.salesman.findUnique({
      where: { id: salesman.id },
      select: { canUploadStock: true, username: true }
    });

    if (!dbSalesman || !dbSalesman.canUploadStock) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to upload stock files. Please contact your administrator.' }, { status: 403 });
    }

    const { items, fileName } = await request.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload: items must be an array' }, { status: 400 });
    }

    // Get the special admin_global salesman
    const globalSalesman = await prisma.salesman.findUnique({
      where: { username: 'admin_global' }
    });

    if (!globalSalesman) {
      return NextResponse.json({ error: 'Global stock repository is not initialized.' }, { status: 500 });
    }

    const getUniquenessKey = (name, mfg, pack) => {
      const cleanName = (name || '').trim().toLowerCase();
      const cleanMfg = (mfg || '').trim().toLowerCase();
      const cleanPack = (pack || '').trim().toLowerCase();
      return `${cleanName}|${cleanMfg}|${cleanPack}`;
    };

    // 2. Clear previous global stock
    await prisma.stockItem.deleteMany({
      where: { salesmanId: globalSalesman.id }
    });

    // 3. Filter and parse uploaded items
    const newItems = [];
    const currentKeys = new Set();
    let skippedCount = 0;

    for (const item of items) {
      if (!item.name || item.quantity === undefined) {
        continue;
      }
      const key = getUniquenessKey(item.name, item.mfg, item.pack);

      if (currentKeys.has(key)) {
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
        salesmanId: globalSalesman.id // Save as global stock item
      });
      currentKeys.add(key);
    }

    // 4. Bulk insert new global items
    if (newItems.length > 0) {
      await prisma.stockItem.createMany({
        data: newItems
      });
    }

    // 5. Log recent stock upload under global list
    try {
      const uploadsSetting = await prisma.setting.findUnique({
        where: { key: 'RECENT_STOCK_UPLOADS' }
      });
      let uploads = [];
      if (uploadsSetting && uploadsSetting.value) {
        try {
          uploads = JSON.parse(uploadsSetting.value);
        } catch (e) {
          uploads = [];
        }
      }
      uploads.unshift({
        timestamp: new Date().toISOString(),
        adminUsername: `rep:${dbSalesman.username}`, // Prefix with rep so admins know it was uploaded by a salesman
        filename: fileName || 'salesman_global_stock.xlsx',
        count: newItems.length
      });
      uploads = uploads.slice(0, 10);

      await prisma.setting.upsert({
        where: { key: 'RECENT_STOCK_UPLOADS' },
        update: { value: JSON.stringify(uploads) },
        create: { key: 'RECENT_STOCK_UPLOADS', value: JSON.stringify(uploads) }
      });
    } catch (logError) {
      console.error('Failed to log salesman global stock upload:', logError);
    }

    return NextResponse.json({
      success: true,
      inserted: newItems.length,
      skipped: skippedCount,
      salesmenCount: 1
    });

  } catch (error) {
    console.error('Salesman bulk upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
