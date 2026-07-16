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
        { error: 'Phone number and password are required' },
        { status: 400 }
      );
    }
    
    // Clean phone number (username)
    const cleanPhone = username.replace(/\D/g, '');
    
    // Check lockout and fetch user in parallel
    const [lockoutTime, retailer] = await Promise.all([
      checkLockout(cleanPhone),
      prisma.retailer.findUnique({
        where: { phone: cleanPhone },
      })
    ]);

    if (lockoutTime) {
      const minutesLeft = Math.ceil((lockoutTime - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many failed attempts. Account is locked. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    if (!retailer) {
      await handleFailedAttempt(cleanPhone);
      return NextResponse.json(
        { error: 'Wrong phone number or password' },
        { status: 401 }
      );
    }

    if (!retailer.active) {
      return NextResponse.json(
        { error: 'Account has been deactivated. Please contact your salesman.' },
        { status: 403 }
      );
    }

    let isValid = false;

    if (!retailer.passwordHash) {
      // Fallback for legacy retailers created before the password system.
      // Their expected password is their phone number.
      if (password === cleanPhone) {
        isValid = true;
        // Hash it and save it so they have a normal hash going forward
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);
        await prisma.retailer.update({
          where: { id: retailer.id },
          data: { passwordHash: hashed }
        });
      }
    } else {
      isValid = await bcrypt.compare(password, retailer.passwordHash);
    }

    if (!isValid) {
      await handleFailedAttempt(cleanPhone);
      return NextResponse.json(
        { error: 'Wrong phone number or password' },
        { status: 401 }
      );
    }

    handleSuccessfulLogin(cleanPhone).catch(console.error);

    // Login successful
    const token = signToken({
      role: 'retailer',
      id: retailer.id,
      shopName: retailer.shopName,
      phone: retailer.phone,
      salesmanId: retailer.salesmanId
    });

    const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
    // Use retailer_session as the cookie name to be consistent with existing logic if any
    setAuthCookie(response, 'retailer_session', token);
    deleteAuthCookie(response, 'admin_session');
    deleteAuthCookie(response, 'salesman_session');
    
    return response;
  } catch (error) {
    console.error('Retailer login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get('retailer_session')?.value;
  if (token) {
    await blacklistToken(token);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  deleteAuthCookie(response, 'retailer_session');
  return response;
}
