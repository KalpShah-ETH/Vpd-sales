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

    // Retrieve stock item with salesman details
    const stockItem = await prisma.stockItem.findUnique({
      where: { id: parseInt(stockItemId) },
      include: {
        salesman: true
      }
    });

    if (!stockItem || !stockItem.salesman || !stockItem.salesman.active) {
      return NextResponse.json({ error: 'Product or company is currently unavailable' }, { status: 404 });
    }

    if (stockItem.quantity <= 0) {
      return NextResponse.json({ error: 'Product is out of stock' }, { status: 400 });
    }

    const orderQty = Math.min(quantity, stockItem.quantity);

    // Save order in database
    const order = await prisma.order.create({
      data: {
        retailerId: dbRetailer.id,
        salesmanId: stockItem.salesman.id,
        productName: stockItem.name,
        quantity: orderQty,
        price: stockItem.price,
        status: 'PENDING'
      }
    });

    // Update stock item quantity in DB (cap at 0)
    const newQty = Math.max(0, stockItem.quantity - orderQty);
    await prisma.stockItem.update({
      where: { id: stockItem.id },
      data: { quantity: newQty }
    });

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
    console.error('Order placement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
