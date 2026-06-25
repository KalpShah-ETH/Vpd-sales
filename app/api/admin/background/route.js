import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const mimeType = file.type || '';
    const filename = file.name || '';
    const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];

    if (!allowedMimeTypes.includes(mimeType) && !allowedExtensions.includes(extension)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, JPEG, and PNG images are supported.' }, { status: 400 });
    }

    let finalMime = mimeType;
    if (!allowedMimeTypes.includes(finalMime)) {
      if (extension === '.png') {
        finalMime = 'image/png';
      } else {
        finalMime = 'image/jpeg';
      }
    }

    const bytes = await file.arrayBuffer();
    const base64String = Buffer.from(bytes).toString('base64');

    // Save to database settings
    await prisma.setting.upsert({
      where: { key: 'RETAILER_BG_DATA' },
      update: { value: base64String },
      create: { key: 'RETAILER_BG_DATA', value: base64String }
    });

    await prisma.setting.upsert({
      where: { key: 'RETAILER_BG_MIME' },
      update: { value: finalMime },
      create: { key: 'RETAILER_BG_MIME', value: finalMime }
    });

    // Update database setting version
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
