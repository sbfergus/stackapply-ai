import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || '';

if (!ENCRYPTION_KEY) {
  console.warn('API_KEY_ENCRYPTION_SECRET not set - API key encryption will fail');
}

/**
 * Encrypts an API key for secure storage
 */
export function encryptApiKey(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('API_KEY_ENCRYPTION_SECRET not configured');
  }

  // Derive 32-byte key from secret
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an API key for use
 */
export function decryptApiKey(encrypted: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('API_KEY_ENCRYPTION_SECRET not configured');
  }

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const [ivHex, authTagHex, encryptedText] = parts;

  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks an API key for display (shows first 8 and last 6 chars)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 14) return '***';
  return `${key.slice(0, 8)}...${key.slice(-6)}`;
}
