import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'RETAILER_BG_VERSION' }
    });
    return NextResponse.json({ RETAILER_BG_VERSION: setting?.value || null });
  } catch (error) {
    console.error('Fetch retailer settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
