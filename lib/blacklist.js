import prisma from './db';

export async function blacklistToken(token) {
  if (!token) return;
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
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'blacklist:' + token }
    });
    return !!setting;
  } catch (err) {
    console.error('Error checking blacklist:', err);
    return false;
  }
}

export async function clearBlacklist() {
  try {
    await prisma.setting.deleteMany({
      where: { key: { startsWith: 'blacklist:' } }
    });
  } catch (err) {
    console.error('Error clearing blacklist:', err);
  }
}
