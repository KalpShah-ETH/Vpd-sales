import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Look up active retailer in database
    const retailer = await prisma.retailer.findUnique({
      where: { 
        token: token,
        active: true
      }
    });

    if (!retailer) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    // Create JWT session token containing retailer details
    const jwtToken = signToken({
      role: 'retailer',
      id: retailer.id,
      shopName: retailer.shopName,
      phone: retailer.phone
    });

    // Redirect to browse view
    const redirectUrl = new URL('/browse', request.url);
    const response = NextResponse.redirect(redirectUrl);
    setAuthCookie(response, 'retailer_session', jwtToken);
    
    return response;
  } catch (error) {
    console.error('Retailer authentication error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { token, deviceKey } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Look up active retailer in database
    const retailer = await prisma.retailer.findUnique({
      where: { 
        token: token,
        active: true
      }
    });

    if (!retailer) {
      return NextResponse.json({ 
        error: 'This private ordering link is invalid or has been deactivated.' 
      }, { status: 403 });
    }

    let newDeviceKey = null;

    // Case A: First time opening the link. Bind the device key.
    if (!retailer.deviceKey) {
      newDeviceKey = crypto.randomBytes(16).toString('hex');
      await prisma.retailer.update({
        where: { id: retailer.id },
        data: { deviceKey: newDeviceKey }
      });
    }
    // Case B: Existing device check. Validate the device key.
    else if (retailer.deviceKey !== deviceKey) {
      return NextResponse.json({ 
        error: 'This ordering link has already been registered to another device. For security, you can only order from your primary registered browser/phone. Please contact your salesman or admin to reset your device connection.' 
      }, { status: 403 });
    }

    // Create JWT session token containing retailer details
    const jwtToken = signToken({
      role: 'retailer',
      id: retailer.id,
      shopName: retailer.shopName,
      phone: retailer.phone
    });

    // Construct response and set cookie
    const response = NextResponse.json({ success: true, newDeviceKey });
    setAuthCookie(response, 'retailer_session', jwtToken);
    
    return response;
  } catch (error) {
    console.error('Retailer authentication error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
