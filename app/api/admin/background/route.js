import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/db';
import { validateSession } from '@/lib/auth';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  return validateSession(cookieStore, 'admin_session', 'admin');
}

export async function POST(request) {
  const admin = await checkAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public directory
    const publicDir = join(process.cwd(), 'public');
    const path = join(publicDir, 'retailer-bg.jpg');

    await writeFile(path, buffer);

    // Update database setting
    const bgVersion = Date.now().toString();
    await prisma.setting.upsert({
      where: { key: 'RETAILER_BG_VERSION' },
      update: { value: bgVersion },
      create: { key: 'RETAILER_BG_VERSION', value: bgVersion }
    });

    return NextResponse.json({ success: true, version: bgVersion });
  } catch (error) {
    console.error('Upload background error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
