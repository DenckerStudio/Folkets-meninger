import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encryptSecret } from '@/lib/byok/crypto';
import { getByokMeta, loadDecryptedByok, type ByokClient } from '@/lib/byok/service';

const previous = process.env.BYOK_ENCRYPTION_KEY;
process.env.BYOK_ENCRYPTION_KEY = 'b'.repeat(64);

const serviceSrc = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
assert.doesNotMatch(serviceSrc, /getServiceSupabase/);
assert.match(serviceSrc, /getServerSupabase/);
assert.match(serviceSrc, /ciphertext_b64, iv_b64, auth_tag_b64/);
assert.doesNotMatch(serviceSrc, /console\.(log|info|debug|error).*apiKey/);

type Row = Record<string, unknown>;

function fakeByokClient(row: Row | null): ByokClient {
  return {
    from: () =>
      ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: row ? null : { message: 'not found' } }),
          }),
        }),
      }) as ReturnType<ByokClient['from']>,
  };
}

const encrypted = encryptSecret('sk-test-session-scoped-key');
const row = {
  provider: 'openai',
  model: 'gpt-4.1-mini',
  base_url: null,
  ciphertext_b64: encrypted.ciphertextB64,
  iv_b64: encrypted.ivB64,
  auth_tag_b64: encrypted.authTagB64,
  key_last4: 'key',
  updated_at: '2026-10-03T00:00:00.000Z',
};

const meta = await getByokMeta('user-1', fakeByokClient(row));
assert.equal(meta?.provider, 'openai');
assert.equal(meta?.keyLast4, 'key');
assert.equal('apiKey' in (meta ?? {}), false);

const loaded = await loadDecryptedByok('user-1', fakeByokClient(row));
assert.equal(loaded?.apiKey, 'sk-test-session-scoped-key');
assert.equal(loaded?.model, 'gpt-4.1-mini');

const missing = await loadDecryptedByok('user-1', fakeByokClient(null));
assert.equal(missing, null);

if (previous === undefined) {
  delete process.env.BYOK_ENCRYPTION_KEY;
} else {
  process.env.BYOK_ENCRYPTION_KEY = previous;
}

console.log('byok/session.test.ts: ok session ciphertext + server decrypt');
