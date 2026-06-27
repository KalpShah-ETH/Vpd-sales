import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

export async function POST(request) {
  const cookieStore = await cookies();
  const retailerSession = await validateSession(cookieStore, 'retailer_session', 'retailer');

  if (!retailerSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    let orderItems = [];

    // Support both bulk { items: [...] } and legacy single { stockItemId, quantity }
    if (body.items && Array.isArray(body.items)) {
      orderItems = body.items;
    } else {
      orderItems = [{ stockItemId: body.stockItemId, quantity: body.quantity }];
    }

    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 });
    }

    for (const entry of orderItems) {
      if (!entry.stockItemId || !entry.quantity || entry.quantity <= 0) {
        return NextResponse.json({ error: 'Invalid item or quantity in order' }, { status: 400 });
      }
    }

    // Verify retailer is active in DB
    const dbRetailer = await prisma.retailer.findUnique({
      where: { id: retailerSession.id }
    });

    if (!dbRetailer || !dbRetailer.active) {
      return NextResponse.json({ error: 'Retailer account is deactivated' }, { status: 403 });
    }

    // Retrieve and update within transaction to prevent race conditions
    const transactionResult = await prisma.$transaction(async (tx) => {
      const orderResults = [];
      let salesman = null;

      // Pre-fetch the retailer's salesman to route global orders to
      if (dbRetailer.salesmanId) {
        salesman = await tx.salesman.findUnique({
          where: { id: dbRetailer.salesmanId }
        });
      }

      for (const entry of orderItems) {
        const stockItem = await tx.stockItem.findUnique({
          where: { id: parseInt(entry.stockItemId) },
          include: {
            salesman: true
          }
        });

        if (!stockItem || !stockItem.salesman) {
          throw { status: 404, error: `Product is currently unavailable` };
        }

        const isGlobal = stockItem.salesman.username === 'admin_global';

        if (!isGlobal && !stockItem.salesman.active) {
          throw { status: 404, error: `Product "${stockItem.name}" or company is currently unavailable` };
        }

        if (!isGlobal && dbRetailer.salesmanId && stockItem.salesmanId !== dbRetailer.salesmanId) {
          throw { status: 403, error: `Unauthorized: Product "${stockItem.name}" does not belong to your company catalog` };
        }

        if (stockItem.quantity < entry.quantity) {
          throw { status: 400, error: `Product "${stockItem.name}" does not have enough stock. Available: ${stockItem.quantity}` };
        }

        if (!isGlobal) {
          salesman = stockItem.salesman;
        }

        // Save order in database
        const order = await tx.order.create({
          data: {
            retailerId: dbRetailer.id,
            salesmanId: dbRetailer.salesmanId || stockItem.salesman.id,
            productName: stockItem.name,
            quantity: entry.quantity,
            price: stockItem.price,
            status: 'PENDING'
          }
        });

        orderResults.push({ order, stockItem, qty: entry.quantity });
      }

      return { orderResults, salesman };
    });

    const { orderResults, salesman } = transactionResult;

    // Normalize salesman's phone number for WhatsApp
    let cleanPhone = salesman.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // Construct pre-filled WhatsApp message
    let message = `${dbRetailer.shopName}\n`;
    for (const res of orderResults) {
      message += `${res.stockItem.name} x ${res.qty}\n`;
    }

    // Construct the wa.me pre-filled link
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      success: true,
      orderId: orderResults[0]?.order.id,
      waUrl
    });
  } catch (error) {
    if (error.status && error.error) {
      return NextResponse.json({ error: error.error }, { status: error.status });
    }
    console.error('Order placement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
