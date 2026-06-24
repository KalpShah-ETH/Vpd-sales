import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

export async function POST(request) {
  const cookieStore = await cookies();
  const retailerSession = validateSession(cookieStore, 'retailer_session', 'retailer');

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

      for (const entry of orderItems) {
        const stockItem = await tx.stockItem.findUnique({
          where: { id: parseInt(entry.stockItemId) },
          include: {
            salesman: true
          }
        });

        if (!stockItem || !stockItem.salesman || !stockItem.salesman.active) {
          throw { status: 404, error: `Product "${stockItem?.name || 'Unknown'}" or company is currently unavailable` };
        }

        if (stockItem.quantity < entry.quantity) {
          throw { status: 400, error: `Product "${stockItem.name}" does not have enough stock. Available: ${stockItem.quantity}` };
        }

        salesman = stockItem.salesman;

        // Update stock item quantity in DB (decrement)
        const updatedStockItem = await tx.stockItem.update({
          where: { id: stockItem.id },
          data: {
            quantity: {
              decrement: entry.quantity
            }
          }
        });

        // If quantity drops below 0, it means another concurrent request got it first
        if (updatedStockItem.quantity < 0) {
          throw { status: 400, error: `Product "${stockItem.name}" is out of stock` };
        }

        // Save order in database
        const order = await tx.order.create({
          data: {
            retailerId: dbRetailer.id,
            salesmanId: stockItem.salesman.id,
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
    let message = `Hello, I am ${dbRetailer.shopName}.\nI want to order the following items from ${salesman.companyName}:\n`;
    let total = 0;
    for (const res of orderResults) {
      const subtotal = res.qty * res.stockItem.price;
      total += subtotal;
      message += `- *${res.stockItem.name}* x ${res.qty} strips (₹${res.stockItem.price.toFixed(2)}/strip)\n`;
    }
    message += `\n*Total Order Value:* ₹${total.toFixed(2)}\n\nPlease confirm and deliver.`;

    // Construct the wa.me pre-filled link
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      success: true,
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
