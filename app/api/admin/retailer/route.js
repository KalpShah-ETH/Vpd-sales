import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

// Helper to check admin permission
async function checkAdminAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'admin_session', 'admin');
}

export async function GET() {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const retailers = await prisma.retailer.findMany({
      orderBy: { id: 'desc' },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });
    return NextResponse.json(retailers);
  } catch (error) {
    console.error('Fetch retailers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ error: 'Retailers can only be added by salesmen' }, { status: 400 });
}

export async function PUT(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, shopName, phone, active, regenerateToken } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Retailer ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (shopName) updateData.shopName = shopName.trim();
    if (phone) {
      // Check phone uniqueness
      const existing = await prisma.retailer.findFirst({
        where: {
          phone: phone.trim(),
          id: { not: parseInt(id) }
        }
      });
      if (existing) {
        return NextResponse.json({ error: 'Phone number already registered' }, { status: 400 });
      }
      updateData.phone = phone.trim();
    }
    if (active !== undefined) updateData.active = active;


    const retailer = await prisma.retailer.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return NextResponse.json({ success: true, retailer });
  } catch (error) {
    console.error('Update retailer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Retailer ID is required' }, { status: 400 });
    }

    try {
      await prisma.retailer.delete({
        where: { id: parseInt(id) }
      });
    } catch (dbErr) {
      if (dbErr.code !== 'P2025') {
        throw dbErr;
      }
    }

    return NextResponse.json({ success: true, message: 'Retailer deleted successfully' });
  } catch (error) {
    console.error('Delete retailer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
