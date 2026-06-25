import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

export async function GET(request) {
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
    const { searchParams } = new URL(request.url);
    const targetCompanyId = searchParams.get('companyId');

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

    if (targetCompanyId) {
      whereClause.id = parseInt(targetCompanyId);
    }

    if (!targetCompanyId) {
      const companies = await prisma.salesman.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          companyName: true,
          phone: true,
          _count: {
            select: { stockItems: true }
          }
        },
        orderBy: { companyName: 'asc' }
      });

      const globalSalesman = await prisma.salesman.findUnique({
        where: { username: 'admin_global' },
        select: {
          _count: {
            select: { stockItems: true }
          }
        }
      });
      const globalCount = globalSalesman?._count.stockItems || 0;

      const result = companies.map(c => ({
        id: c.id,
        name: c.name,
        companyName: c.companyName,
        phone: c.phone,
        stockItemsCount: c._count.stockItems + globalCount,
        stockItems: []
      }));

      return NextResponse.json(result);
    }

    const page = parseInt(searchParams.get('page')) || 1;
    const search = searchParams.get('search') || '';
    const limit = 50;
    const skip = (page - 1) * limit;

    const ownItemsWhere = { salesmanId: parseInt(targetCompanyId) };
    if (search) {
      ownItemsWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mfg: { contains: search, mode: 'insensitive' } }
      ];
    }

    const ownItems = await prisma.stockItem.findMany({
      where: ownItemsWhere,
      select: {
        id: true,
        name: true,
        price: true,
        quantity: true,
        mfg: true,
        pack: true
      },
      orderBy: { name: 'asc' }
    });

    const company = await prisma.salesman.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        companyName: true,
        phone: true
      }
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const globalSalesman = await prisma.salesman.findUnique({
      where: { username: 'admin_global' }
    });

    const globalItemsWhere = { salesmanId: globalSalesman?.id || -1 };
    if (search) {
      globalItemsWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mfg: { contains: search, mode: 'insensitive' } }
      ];
    }

    const globalItemsRaw = globalSalesman ? await prisma.stockItem.findMany({
      where: globalItemsWhere,
      select: {
        id: true,
        name: true,
        price: true,
        quantity: true,
        mfg: true,
        pack: true
      },
      orderBy: { name: 'asc' }
    }) : [];

    const globalItems = globalItemsRaw.map(item => ({
      ...item,
      isAdminGlobal: true
    }));

    const getUniquenessKey = (name, mfg, pack) => {
      const cleanName = (name || '').trim().toLowerCase();
      const cleanMfg = (mfg || '').trim().toLowerCase();
      const cleanPack = (pack || '').trim().toLowerCase();
      return `${cleanName}|${cleanMfg}|${cleanPack}`;
    };

    const ownKeys = new Set(ownItems.map(item => getUniquenessKey(item.name, item.mfg, item.pack)));
    const filteredGlobalItems = globalItems.filter(item => !ownKeys.has(getUniquenessKey(item.name, item.mfg, item.pack)));
    
    const merged = [
      ...ownItems.map(item => ({ ...item, isAdminGlobal: false })),
      ...filteredGlobalItems
    ].sort((a, b) => a.name.localeCompare(b.name));

    const totalItems = merged.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginated = merged.slice(skip, skip + limit);

    return NextResponse.json({
      company,
      stockItems: paginated,
      totalItems,
      totalPages,
      page
    });
  } catch (error) {
    console.error('Fetch catalog error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
