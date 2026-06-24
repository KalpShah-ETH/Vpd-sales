import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

async function checkSalesmanAuth() {
  const cookieStore = await cookies();
  return validateSession(cookieStore, 'salesman_session', 'salesman');
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
      select: { name: true }
    });

    const existingNames = new Set(existingItems.map(item => item.name.trim().toLowerCase()));

    // 2. Filter new items
    const newItems = [];
    let skippedCount = 0;

    for (const item of items) {
      if (!item.name || item.price === undefined || item.quantity === undefined) {
        continue;
      }
      const trimmedName = item.name.trim();
      const lowerName = trimmedName.toLowerCase();

      if (existingNames.has(lowerName)) {
        skippedCount++;
        continue;
      }

      const numPrice = parseFloat(item.price);
      const numQty = parseInt(item.quantity);

      if (isNaN(numPrice) || numPrice < 0 || isNaN(numQty) || numQty < 0) {
        continue; // Skip invalid items
      }

      newItems.push({
        name: trimmedName,
        price: numPrice,
        quantity: numQty,
        salesmanId: salesman.id
      });
      // Add to set to prevent duplicates within the uploaded batch itself
      existingNames.add(lowerName);
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
