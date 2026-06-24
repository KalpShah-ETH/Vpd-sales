import prisma from './db';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Checks if a user is currently locked out.
 * Returns the lock expiration date if locked, otherwise null.
 */
export async function checkLockout(username) {
  if (!username) return null;
  const key = `login_fail:${username.trim().toLowerCase()}`;
  try {
    const record = await prisma.setting.findUnique({
      where: { key }
    });
    if (!record) return null;

    const data = JSON.parse(record.value);
    if (data.lockoutUntil && data.lockoutUntil > Date.now()) {
      return new Date(data.lockoutUntil);
    }
    
    // If lockout duration passed, we don't block
    return null;
  } catch (err) {
    console.error('Lockout check error:', err);
    return null;
  }
}

/**
 * Increments failed attempts and triggers lockout if max attempts are reached.
 */
export async function handleFailedAttempt(username) {
  if (!username) return;
  const key = `login_fail:${username.trim().toLowerCase()}`;
  try {
    const record = await prisma.setting.findUnique({
      where: { key }
    });

    let attempts = 1;
    let lockoutUntil = null;

    if (record) {
      const data = JSON.parse(record.value);
      
      // If previous lockout expired, reset attempts count
      if (data.lockoutUntil && data.lockoutUntil <= Date.now()) {
        attempts = 1;
      } else {
        attempts = (data.attempts || 0) + 1;
      }

      if (attempts >= MAX_ATTEMPTS) {
        lockoutUntil = Date.now() + LOCKOUT_DURATION;
      }
    }

    const value = JSON.stringify({ attempts, lockoutUntil });

    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  } catch (err) {
    console.error('Failed login attempt update error:', err);
  }
}

/**
 * Resets failed attempts after a successful login.
 */
export async function handleSuccessfulLogin(username) {
  if (!username) return;
  const key = `login_fail:${username.trim().toLowerCase()}`;
  try {
    await prisma.setting.delete({
      where: { key }
    });
  } catch (err) {
    // Record might not exist, which is fine
    if (err.code !== 'P2025') {
      console.error('Reset login failures error:', err);
    }
  }
}
