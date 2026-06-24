import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  
  // A retailer, salesman, or admin can access the catalog
  const retailer = validateSession(cookieStore, 'retailer_session', 'retailer');
  const salesman = validateSession(cookieStore, 'salesman_session', 'salesman');
  const admin = validateSession(cookieStore, 'admin_session', 'admin');
  
  if (!retailer && !salesman && !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const whereClause = { active: true };

    if (retailer) {
      const dbRetailer = await prisma.retailer.findUnique({
        where: { id: retailer.id },
        select: { salesmanId: true }
      });
      if (dbRetailer && dbRetailer.salesmanId) {
        whereClause.id = dbRetailer.salesmanId;
      }
    }

    const companies = await prisma.salesman.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        companyName: true,
        phone: true,
        stockItems: {
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { companyName: 'asc' }
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error('Fetch catalog error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
