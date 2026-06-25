import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
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

  try {
    const body = await request.json();

    // Check if it's a bulk upload
    if (body.retailers && Array.isArray(body.retailers)) {
      const { retailers } = body;
      const results = [];
      const errors = [];

      for (const item of retailers) {
        const { shopName, phone } = item;
        if (!shopName || !phone) {
          errors.push({ item, error: 'Shop name and phone are required' });
          continue;
        }

        try {
          // Check uniqueness
          const existing = await prisma.retailer.findUnique({
            where: { phone: phone.trim() },
          });

          if (existing) {
            // Update token/shopName for existing if we want to regenerate link
            const token = crypto.randomBytes(16).toString('hex');
            const updated = await prisma.retailer.update({
              where: { phone: phone.trim() },
              data: { shopName, token, active: true }
            });
            results.push(updated);
          } else {
            const token = crypto.randomBytes(16).toString('hex');
            const created = await prisma.retailer.create({
              data: {
                shopName: shopName.trim(),
                phone: phone.trim(),
                token,
                active: true
              }
            });
            results.push(created);
          }
        } catch (e) {
          errors.push({ item, error: e.message });
        }
      }

      return NextResponse.json({
        success: true,
        count: results.length,
        results,
        errors
      });
    }

    // Single creation
    const { shopName, phone } = body;
    if (!shopName || !phone) {
      return NextResponse.json({ error: 'Shop name and phone are required' }, { status: 400 });
    }

    const existing = await prisma.retailer.findUnique({
      where: { phone: phone.trim() }
    });

    if (existing) {
      return NextResponse.json({ error: 'Retailer with this phone number already exists' }, { status: 400 });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const retailer = await prisma.retailer.create({
      data: {
        shopName: shopName.trim(),
        phone: phone.trim(),
        token,
        active: true
      }
    });

    return NextResponse.json({ success: true, retailer });
  } catch (error) {
    console.error('Create retailer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
    if (regenerateToken) {
      updateData.token = crypto.randomBytes(16).toString('hex');
    }

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
