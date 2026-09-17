import crypto from 'node:crypto';
import { env } from './env';

// Envelope encryption:
//  - Each workspace gets its own Data Encryption Key (DEK), a random 32-byte AES-256 key.
//  - The DEK itself is encrypted ("wrapped") with a Key Encryption Key (KEK) that comes
//    only from the KEK_BASE64 env var - it is never stored in the database or logged.
//  - Provider API keys are encrypted with the workspace's DEK, not the KEK directly, so
//    rotating/re-wrapping the KEK never requires re-encrypting every stored secret.

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

function getKek(): Buffer {
  const kek = Buffer.from(env.kekBase64, 'base64');
  if (kek.length !== 32) {
    throw new Error('KEK_BASE64 must decode to exactly 32 bytes (AES-256 key).');
  }
  return kek;
}

function encryptWithKey(plaintext: Buffer, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptWithKey(payload: EncryptedPayload, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
}

/** Generates a brand-new random 32-byte Data Encryption Key for a workspace. */
export function generateDek(): Buffer {
  return crypto.randomBytes(32);
}

/** Wraps (encrypts) a workspace DEK with the master KEK, for storage in the DB. */
export function wrapDek(dek: Buffer): EncryptedPayload {
  return encryptWithKey(dek, getKek());
}

/** Unwraps (decrypts) a workspace DEK using the master KEK. */
export function unwrapDek(wrapped: EncryptedPayload): Buffer {
  return decryptWithKey(wrapped, getKek());
}

/** Encrypts a plaintext secret (e.g. a provider API key) with a workspace's DEK. */
export function encryptWithDek(plaintext: string, dek: Buffer): EncryptedPayload {
  return encryptWithKey(Buffer.from(plaintext, 'utf8'), dek);
}

/** Decrypts a secret previously encrypted with encryptWithDek. Result must be used
 *  immediately and never stored, logged, or returned from an API response. */
export function decryptWithDek(payload: EncryptedPayload, dek: Buffer): string {
  return decryptWithKey(payload, dek).toString('utf8');
}

/** Serializes an EncryptedPayload to a single string for a single DB column, and back. */
export function packEncrypted(payload: EncryptedPayload): string {
  return JSON.stringify(payload);
}

export function unpackEncrypted(packed: string): EncryptedPayload {
  return JSON.parse(packed) as EncryptedPayload;
}
