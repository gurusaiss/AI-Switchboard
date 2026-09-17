import { describe, it, expect } from 'vitest';
import {
  generateDek,
  wrapDek,
  unwrapDek,
  encryptWithDek,
  decryptWithDek,
  packEncrypted,
  unpackEncrypted,
} from '../src/lib/crypto';

describe('envelope encryption', () => {
  it('round-trips a DEK through KEK wrap/unwrap', () => {
    const dek = generateDek();
    const wrapped = wrapDek(dek);
    const unwrapped = unwrapDek(wrapped);
    expect(unwrapped.equals(dek)).toBe(true);
  });

  it('round-trips a secret through DEK encrypt/decrypt', () => {
    const dek = generateDek();
    const plaintext = 'sk-super-secret-provider-key-12345';
    const encrypted = encryptWithDek(plaintext, dek);
    const decrypted = decryptWithDek(encrypted, dek);
    expect(decrypted).toBe(plaintext);
  });

  it('never stores the plaintext in the ciphertext blob', () => {
    const dek = generateDek();
    const plaintext = 'sk-super-secret-provider-key-12345';
    const encrypted = encryptWithDek(plaintext, dek);
    const packed = packEncrypted(encrypted);
    expect(packed).not.toContain(plaintext);
    expect(encrypted.ciphertext).not.toContain(plaintext);
  });

  it('fails to decrypt with the wrong key', () => {
    const dek = generateDek();
    const wrongDek = generateDek();
    const encrypted = encryptWithDek('hello world', dek);
    expect(() => decryptWithDek(encrypted, wrongDek)).toThrow();
  });

  it('fails to decrypt if the ciphertext is tampered with', () => {
    const dek = generateDek();
    const encrypted = encryptWithDek('hello world', dek);
    const tampered = { ...encrypted, ciphertext: Buffer.from('tampered-data').toString('base64') };
    expect(() => decryptWithDek(tampered, dek)).toThrow();
  });

  it('pack/unpack is lossless', () => {
    const dek = generateDek();
    const encrypted = encryptWithDek('round trip me', dek);
    const packed = packEncrypted(encrypted);
    const unpacked = unpackEncrypted(packed);
    expect(decryptWithDek(unpacked, dek)).toBe('round trip me');
  });
});
