import crypto from 'crypto';
import { scryptSync, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

export class EncryptionService {
  private readonly masterKey: string;

  constructor(masterKey?: string) {
    this.masterKey = masterKey ?? process.env.ENCRYPTION_KEY ?? '';
    if (!this.masterKey || this.masterKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
  }

  encrypt(plaintext: string): string {
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = deriveKey(this.masterKey, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result.toString('base64url');
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64url');

    let offset = 0;
    const salt = buf.subarray(offset, (offset += SALT_LEN));
    const iv = buf.subarray(offset, (offset += IV_LEN));
    const authTag = buf.subarray(offset, (offset += AUTH_TAG_LEN));
    const encrypted = buf.subarray(offset);

    const key = deriveKey(this.masterKey, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  generateApiKey(): { raw: string; hash: string; prefix: string } {
    const raw = `lck_${randomBytes(32).toString('base64url')}`;
    const prefix = raw.slice(0, 10);
    const hash = this.hashApiKey(raw);
    return { raw, hash, prefix };
  }
}

export const encryptionService = new EncryptionService();

export function generateVerificationCode(digits: number): string {
  const max = Math.pow(10, digits);
  const buf = randomBytes(4);
  return (buf.readUInt32BE(0) % max).toString().padStart(digits, '0');
}

export function generateSecureToken(): string {
  return randomBytes(32).toString('base64url');
}
