import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  
  // Short-circuit: only validate session if corresponding cookie exists
  const hasRetailerCookie = cookieStore.has('retailer_session');
  const hasSalesmanCookie = cookieStore.has('salesman_session');
  const hasAdminCookie = cookieStore.has('admin_session');

  // A retailer, salesman, or admin can access the catalog
  const retailer = hasRetailerCookie ? await validateSession(cookieStore, 'retailer_session', 'retailer') : null;
  const salesman = (!retailer && hasSalesmanCookie) ? await validateSession(cookieStore, 'salesman_session', 'salesman') : null;
  const admin = (!retailer && !salesman && hasAdminCookie) ? await validateSession(cookieStore, 'admin_session', 'admin') : null;
  
  if (!retailer && !salesman && !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const whereClause = { active: true, NOT: { username: 'admin_global' } };

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
          select: {
            id: true,
            name: true,
            price: true,
            quantity: true,
            mfg: true,
            pack: true
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { companyName: 'asc' }
    });

    // Fetch the shared stock items uploaded by admin
    const globalSalesman = await prisma.salesman.findUnique({
      where: { username: 'admin_global' },
      include: {
        stockItems: {
          select: {
            id: true,
            name: true,
            price: true,
            quantity: true,
            mfg: true,
            pack: true
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    const getUniquenessKey = (name, mfg, pack) => {
      const cleanName = (name || '').trim().toLowerCase();
      const cleanMfg = (mfg || '').trim().toLowerCase();
      const cleanPack = (pack || '').trim().toLowerCase();
      return `${cleanName}|${cleanMfg}|${cleanPack}`;
    };

    const globalItems = (globalSalesman?.stockItems || []).map(item => ({
      ...item,
      isAdminGlobal: true
    }));

    // Merge the global items into each company's stock list, skipping overlapping items
    const mergedCompanies = companies.map(company => {
      const ownKeys = new Set(company.stockItems.map(item => getUniquenessKey(item.name, item.mfg, item.pack)));
      const filteredGlobalItems = globalItems.filter(item => !ownKeys.has(getUniquenessKey(item.name, item.mfg, item.pack)));
      return {
        ...company,
        stockItems: [...company.stockItems, ...filteredGlobalItems].sort((a, b) => a.name.localeCompare(b.name))
      };
    });

    return NextResponse.json(mergedCompanies);
  } catch (error) {
    console.error('Fetch catalog error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
