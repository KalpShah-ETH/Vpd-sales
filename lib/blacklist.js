import prisma from './db';

const memCache = new Map(); // token → { result, cachedAt }
const TTL = 5 * 60 * 1000;  // 5 minutes in ms

export async function blacklistToken(token) {
  if (!token) return;
  memCache.set(token, { result: true, cachedAt: Date.now() });
  try {
    await prisma.setting.upsert({
      where: { key: 'blacklist:' + token },
      update: {},
      create: { key: 'blacklist:' + token, value: 'true' }
    });
  } catch (err) {
    console.error('Error blacklisting token:', err);
  }
}

export async function isTokenBlacklisted(token) {
  if (!token) return false;
  const cached = memCache.get(token);
  if (cached && (Date.now() - cached.cachedAt) < TTL) {
    return cached.result;
  }
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'blacklist:' + token }
    });
    const result = !!setting;
    memCache.set(token, { result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    console.error('Error checking blacklist:', err);
    return false;
  }
}

export async function clearBlacklist() {
  memCache.clear();
  try {
    await prisma.setting.deleteMany({
      where: { key: { startsWith: 'blacklist:' } }
    });
  } catch (err) {
    console.error('Error clearing blacklist:', err);
  }
}
