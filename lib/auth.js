import jwt from 'jsonwebtoken';


import { blacklistToken, isTokenBlacklisted } from './blacklist';

export { blacklistToken, isTokenBlacklisted };

/**
 * Sign a JWT token
 */
export function signToken(payload, expiresIn = '30d') {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET environment variable is not defined');
    return null;
  }
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Set a secure cookie
 */
export function setAuthCookie(response, name, token, maxAgeSeconds = 30 * 24 * 60 * 60) {
  const expires = new Date();
  expires.setSeconds(expires.getSeconds() + maxAgeSeconds);
  
  response.cookies.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
    expires: expires,
  });
  return response;
}

/**
 * Delete an auth cookie
 */
export function deleteAuthCookie(response, name) {
  response.cookies.set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

/**
 * Get token from cookies in a standard request
 */
export function getTokenFromRequest(request, name) {
  const cookie = request.cookies.get(name);
  return cookie ? cookie.value : null;
}

/**
 * Validates a session cookie for a specific role.
 * Works inside Next.js Server Components and API routes.
 * @param {import('next/headers').ReadonlyRequestCookies | any} cookiesObj
 * @param {string} cookieName
 * @param {string} expectedRole
 * @returns {object|null} The decoded token payload or null if invalid
 */
export async function validateSession(cookiesObj, cookieName, expectedRole) {
  const token = cookiesObj.get(cookieName)?.value;
  if (!token) return null;
  
  if (await isTokenBlacklisted(token)) {
    return null;
  }
  
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== expectedRole) {
    return null;
  }
  return decoded;
}

/**
 * Validates a session token synchronously by checking only the signature and role.
 * Bypasses the database blacklist lookup to allow rapid page rendering.
 */
export function validateSessionFast(cookiesObj, cookieName, expectedRole) {
  const token = cookiesObj.get(cookieName)?.value;
  if (!token) return null;
  
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== expectedRole) {
    return null;
  }
  return decoded;
}

