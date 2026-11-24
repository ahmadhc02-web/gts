const crypto = require('crypto');

const EXAMPLE_ENC_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getEncryptionKey() {
  const hexKey = process.env.RADIUS_ENC_KEY;
  if (!hexKey || !/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('RADIUS_ENC_KEY must be exactly 64 hex characters (32 bytes)');
  }
  const lower = hexKey.toLowerCase();
  if (lower === EXAMPLE_ENC_KEY || /^(.)\1{63}$/.test(lower)) {
    throw new Error('RADIUS_ENC_KEY must not be the example key or all the same character');
  }
  return Buffer.from(hexKey, 'hex');
}

function encrypt(text) {
  if (!text) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(payload) {
  if (!payload || typeof payload !== 'string') return null;
  try {
    const parts = payload.split('.');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    return null;
  }
}

module.exports = { encrypt, decrypt };
