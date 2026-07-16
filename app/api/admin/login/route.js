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
    const [lockoutTime, admin] = await Promise.all([
      checkLockout(username),
      prisma.admin.findUnique({
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

    if (!admin) {
      await handleFailedAttempt(username);
      return NextResponse.json(
        { error: 'Wrong username or password' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
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
      role: 'admin',
      id: admin.id,
      username: admin.username,
    });

    const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
    setAuthCookie(response, 'admin_session', token);
    deleteAuthCookie(response, 'salesman_session');
    deleteAuthCookie(response, 'retailer_session');
    
    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support simple logout through this route
export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (token) {
    await blacklistToken(token);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  deleteAuthCookie(response, 'admin_session');
  return response;
}
