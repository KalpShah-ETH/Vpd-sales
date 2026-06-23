import fs from 'fs';
import path from 'path';

const blacklistFile = path.join(process.cwd(), 'lib', 'blacklist.json');

function readBlacklist() {
  try {
    if (!fs.existsSync(blacklistFile)) {
      return [];
    }
    const content = fs.readFileSync(blacklistFile, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    return [];
  }
}

function writeBlacklist(list) {
  try {
    fs.writeFileSync(blacklistFile, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing blacklist:', err);
  }
}

export function blacklistToken(token) {
  if (!token) return;
  const list = readBlacklist();
  if (!list.includes(token)) {
    list.push(token);
    writeBlacklist(list);
  }
}

export function isTokenBlacklisted(token) {
  if (!token) return false;
  const list = readBlacklist();
  return list.includes(token);
}

export function clearBlacklist() {
  writeBlacklist([]);
}
