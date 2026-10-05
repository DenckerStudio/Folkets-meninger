import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const SALT = 'folkets-byok-v1';

export class ByokEncryptionNotConfiguredError extends Error {
  constructor() {
    super('BYOK_ENCRYPTION_KEY is not configured');
    this.name = 'ByokEncryptionNotConfiguredError';
  }
}

export function isByokEncryptionConfigured(): boolean {
  return Boolean(process.env.BYOK_ENCRYPTION_KEY?.trim());
}

export function getByokEncryptionKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new ByokEncryptionNotConfiguredError();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return scryptSync(raw, SALT, 32);
}

export type EncryptedSecret = {
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
};

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getByokEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertextB64: ciphertext.toString('base64'),
    ivB64: iv.toString('base64'),
    authTagB64: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(encrypted: EncryptedSecret): string {
  const decipher = createDecipheriv(
    ALGO,
    getByokEncryptionKey(),
    Buffer.from(encrypted.ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function keyLast4(value: string): string {
  const trimmed = value.trim();
  return trimmed.slice(-4);
}
