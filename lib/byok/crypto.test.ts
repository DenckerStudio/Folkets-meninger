import assert from 'node:assert/strict';
import {
  decryptSecret,
  encryptSecret,
  isByokEncryptionConfigured,
  keyLast4,
} from './crypto';

const previous = process.env.BYOK_ENCRYPTION_KEY;
process.env.BYOK_ENCRYPTION_KEY = 'a'.repeat(64);

assert.equal(isByokEncryptionConfigured(), true);
assert.equal(keyLast4('sk-test-abcdef'), 'cdef');

const encrypted = encryptSecret('sk-live-secret-value');
assert.notEqual(encrypted.ciphertextB64, 'sk-live-secret-value');
assert.equal(decryptSecret(encrypted), 'sk-live-secret-value');

const again = encryptSecret('sk-live-secret-value');
assert.notEqual(again.ivB64, encrypted.ivB64);

if (previous === undefined) {
  delete process.env.BYOK_ENCRYPTION_KEY;
} else {
  process.env.BYOK_ENCRYPTION_KEY = previous;
}

console.log('byok/crypto.test.ts: ok');
