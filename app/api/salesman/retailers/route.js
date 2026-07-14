import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

async function checkSalesmanAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'salesman_session', 'salesman');
}

export async function GET() {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const retailers = await prisma.retailer.findMany({
      where: { salesmanId: salesman.id },
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(retailers);
  } catch (error) {
    console.error('Fetch salesman retailers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const salesman = await checkSalesmanAuth();
  if (!salesman) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { shopName, phone } = await request.json();
    if (!shopName || !phone) {
      return NextResponse.json({ error: 'Shop name and phone are required' }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    // Check if retailer with this phone exists
    const existing = await prisma.retailer.findUnique({
      where: { phone: cleanPhone },
      include: { salesman: true }
    });

    if (existing) {
      if (existing.salesmanId && existing.salesmanId !== salesman.id) {
        return NextResponse.json({ 
          error: `This phone number is already registered under another company/salesman (${existing.salesman?.companyName || 'another rep'})` 
        }, { status: 400 });
      }

      // If exists but has no salesman (e.g. legacy/admin created), assign it to this salesman and reset passwordHash
      const passwordHash = await bcrypt.hash(cleanPhone, 10);
      const updated = await prisma.retailer.update({
        where: { phone: cleanPhone },
        data: {
          shopName: shopName.trim(),
          passwordHash,
          active: true,
          salesmanId: salesman.id
        }
      });
      return NextResponse.json({ success: true, retailer: updated });
    }

    // Create new retailer assigned to this salesman
    const passwordHash = await bcrypt.hash(cleanPhone, 10);
    const retailer = await prisma.retailer.create({
      data: {
        shopName: shopName.trim(),
        phone: cleanPhone,
        passwordHash,
        active: true,
        salesmanId: salesman.id
      }
    });

    return NextResponse.json({ success: true, retailer });
  } catch (error) {
    console.error('Create salesman retailer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
