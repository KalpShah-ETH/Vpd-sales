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
    const { stockItemId, quantity } = await request.json();

    if (!stockItemId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid stock item or quantity' }, { status: 400 });
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
      // Retrieve stock item with salesman details
      const stockItem = await tx.stockItem.findUnique({
        where: { id: parseInt(stockItemId) },
        include: {
          salesman: true
        }
      });

      if (!stockItem || !stockItem.salesman || !stockItem.salesman.active) {
        throw { status: 404, error: 'Product or company is currently unavailable' };
      }

      if (stockItem.quantity <= 0) {
        throw { status: 400, error: 'Product is out of stock' };
      }

      const orderQty = Math.min(quantity, stockItem.quantity);

      // Update stock item quantity in DB (decrement)
      const updatedStockItem = await tx.stockItem.update({
        where: { id: stockItem.id },
        data: {
          quantity: {
            decrement: orderQty
          }
        }
      });

      // If quantity drops below 0, it means another concurrent request got it first
      if (updatedStockItem.quantity < 0) {
        throw { status: 400, error: 'Product is out of stock' };
      }

      // Save order in database
      const order = await tx.order.create({
        data: {
          retailerId: dbRetailer.id,
          salesmanId: stockItem.salesman.id,
          productName: stockItem.name,
          quantity: orderQty,
          price: stockItem.price,
          status: 'PENDING'
        }
      });

      return { order, orderQty, stockItem };
    });

    const { order, orderQty, stockItem } = transactionResult;

    // Normalize salesman's phone number for WhatsApp
    // Needs to be in format 91XXXXXXXXXX (e.g. without spaces, dashes, +, and prepend 91 for India if only 10 digits)
    let cleanPhone = stockItem.salesman.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // Construct pre-filled WhatsApp message
    const message = `Hello, I am ${dbRetailer.shopName}.\nI want to order ${orderQty} units of ${stockItem.name} from ${stockItem.salesman.companyName}.\nPlease confirm and deliver.`;
    
    // Construct the wa.me pre-filled link
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      success: true,
      orderId: order.id,
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
