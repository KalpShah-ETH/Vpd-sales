import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // Perform a lightweight database query to wake up the compute instance
    await prisma.$executeRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'warm' });
  } catch (error) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}
