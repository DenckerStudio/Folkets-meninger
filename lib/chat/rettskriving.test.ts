import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { DecryptedByokCredential } from '@/lib/byok/service';
import { RETTSSKRIVING_INSTRUCTION } from '@/lib/chat/actions';
import {
  RETTSSKRIVING_PROVIDER_ERROR,
  resolveRettsskrivingResult,
} from '@/lib/chat/rettskriving';

const rettSrc = readFileSync(new URL('./rettskriving.ts', import.meta.url), 'utf8');
const routeSrc = readFileSync(new URL('../../app/api/chat/rettskriving/route.ts', import.meta.url), 'utf8');

assert.match(rettSrc, /generateText/);
assert.match(rettSrc, /Output\.object/);
assert.match(rettSrc, /createUserLanguageModel/);
assert.doesNotMatch(rettSrc, /runtime\s*=\s*['"]edge['"]/);
assert.doesNotMatch(rettSrc, /console\.(log|info|debug|error).*apiKey/);
assert.doesNotMatch(rettSrc, /streamText/);

assert.match(routeSrc, /loadDecryptedByok\(gate\.userId, session\)/);
assert.match(routeSrc, /getServerSupabase/);
assert.match(routeSrc, /maxDuration/);
assert.doesNotMatch(routeSrc, /runtime\s*=\s*['"]edge['"]/);
assert.doesNotMatch(routeSrc, /getServiceSupabase/);

const fakeCredential: DecryptedByokCredential = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  baseUrl: null,
  keyLast4: 'test',
  updatedAt: '2026-10-03T00:00:00.000Z',
  apiKey: 'sk-test-injected-corrector-never-sent',
};

async function main() {
  let correctCalls = 0;
  const inject = async () => {
    correctCalls += 1;
    return {
      original: 'Stortinget bør vurdere forslaget om klima.',
      context: 'diskusjon' as const,
      instruction: RETTSSKRIVING_INSTRUCTION,
      published: false as const,
      mode: 'corrected' as const,
      corrected: 'Stortinget bør vurdere forslaget om klima.',
      notes: 'Ingen endringer.',
    };
  };

  const noKey = await resolveRettsskrivingResult({
    draft: 'Stortinget bør vurdere forslaget om klima.',
    context: 'diskusjon',
    credential: null,
    correctDraft: inject,
  });
  assert.equal(noKey.ok, true);
  if (!noKey.ok) throw new Error('expected no-key ok');
  assert.equal(noKey.result.mode, 'instruction');
  assert.equal(noKey.result.corrected, null);
  assert.equal(noKey.result.notes, null);
  assert.equal(noKey.result.published, false);
  assert.equal(correctCalls, 0);

  const keyed = await resolveRettsskrivingResult({
    draft: 'Stortinget bør vurdere forslaget om klima.',
    context: 'diskusjon',
    credential: fakeCredential,
    correctDraft: inject,
  });
  assert.equal(keyed.ok, true);
  if (!keyed.ok) throw new Error('expected keyed ok');
  assert.equal(keyed.result.mode, 'corrected');
  assert.equal(keyed.result.corrected, 'Stortinget bør vurdere forslaget om klima.');
  assert.equal(keyed.result.notes, 'Ingen endringer.');
  assert.equal(keyed.result.published, false);
  assert.equal(correctCalls, 1);

  const providerFail = await resolveRettsskrivingResult({
    draft: 'Stortinget bør vurdere forslaget om klima.',
    context: 'diskusjon',
    credential: fakeCredential,
    correctDraft: async () => {
      throw new Error('sk-live-should-be-redacted');
    },
  });
  assert.equal(providerFail.ok, false);
  if (providerFail.ok) throw new Error('expected provider fail');
  assert.equal(providerFail.providerError, true);
  assert.equal(providerFail.error, RETTSSKRIVING_PROVIDER_ERROR);
  assert.doesNotMatch(providerFail.error, /sk-live/);

  const tooShort = await resolveRettsskrivingResult({
    draft: 'kort',
    context: 'annet',
    credential: fakeCredential,
    correctDraft: inject,
  });
  assert.equal(tooShort.ok, false);
  if (tooShort.ok) throw new Error('expected validation fail');
  assert.equal(tooShort.providerError, false);
  assert.equal(correctCalls, 1);

  console.log('chat/rettskriving.test.ts: ok instruction vs keyed correction');
}

void main();
