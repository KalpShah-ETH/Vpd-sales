import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { signToken, setAuthCookie, deleteAuthCookie, blacklistToken } from '@/lib/auth';
import { checkLockout, handleFailedAttempt, handleSuccessfulLogin } from '@/lib/lockout';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }
    
    // Check lockout and fetch user in parallel
    const [lockoutTime, salesman] = await Promise.all([
      checkLockout(username),
      prisma.salesman.findUnique({
        where: { username },
      })
    ]);

    if (lockoutTime) {
      const minutesLeft = Math.ceil((lockoutTime - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many failed attempts. Account is locked. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    if (!salesman) {
      await handleFailedAttempt(username);
      return NextResponse.json(
        { error: 'Wrong username or password' },
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
      await handleFailedAttempt(username);
      return NextResponse.json(
        { error: 'Wrong username or password' },
        { status: 401 }
      );
    }

    handleSuccessfulLogin(username).catch(console.error);

    // Login successful
    const token = signToken({
      role: 'salesman',
      id: salesman.id,
      name: salesman.name,
      companyName: salesman.companyName,
      phone: salesman.phone,
      canUploadStock: salesman.canUploadStock
    });

    const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
    setAuthCookie(response, 'salesman_session', token);
    deleteAuthCookie(response, 'admin_session');
    deleteAuthCookie(response, 'retailer_session');
    
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
  const cookieStore = await cookies();
  const token = cookieStore.get('salesman_session')?.value;
  if (token) {
    await blacklistToken(token);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  deleteAuthCookie(response, 'salesman_session');
  return response;
}
