import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { signToken, setAuthCookie, deleteAuthCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const salesman = await prisma.salesman.findUnique({
      where: { username },
    });

    if (!salesman) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!salesman.active) {
      return NextResponse.json(
        { error: 'Account has been deactivated. Please contact administrator.' },
        { status: 403 }
      );
    }

    const isMatch = await bcrypt.compare(password, salesman.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Login successful
    const token = signToken({
      role: 'salesman',
      id: salesman.id,
      name: salesman.name,
      companyName: salesman.companyName,
      phone: salesman.phone
    });

    const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
    setAuthCookie(response, 'salesman_session', token);
    
    return response;
  } catch (error) {
    console.error('Salesman login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support logout
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  deleteAuthCookie(response, 'salesman_session');
  return response;
}
