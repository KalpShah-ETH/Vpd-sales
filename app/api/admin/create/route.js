import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  return await validateSession(cookieStore, 'admin_session', 'admin');
}

export async function POST(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters long' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { username: trimmedUsername }
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create admin
    const newAdmin = await prisma.admin.create({
      data: {
        username: trimmedUsername,
        passwordHash
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        id: newAdmin.id,
        username: newAdmin.username
      }
    });
  } catch (error) {
    console.error('Create admin account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminCount = await prisma.admin.count();

    const uploadsSetting = await prisma.setting.findUnique({
      where: { key: 'RECENT_STOCK_UPLOADS' }
    });

    let recentUploads = [];
    if (uploadsSetting && uploadsSetting.value) {
      try {
        recentUploads = JSON.parse(uploadsSetting.value);
      } catch (e) {
        recentUploads = [];
      }
    }

    const bgVersionSetting = await prisma.setting.findUnique({
      where: { key: 'RETAILER_BG_VERSION' }
    });
    const bgVersion = bgVersionSetting ? bgVersionSetting.value : null;

    return NextResponse.json({
      adminCount,
      recentUploads,
      bgVersion
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
