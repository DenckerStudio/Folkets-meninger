import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BYOK_OLLAMA_PROBE_ERROR_NB,
  BYOK_OLLAMA_PROBE_HTTP_STATUS,
} from '@/lib/byok/url-guard';

const routeSrc = readFileSync(
  new URL('./route.ts', import.meta.url),
  'utf8',
);

assert.match(routeSrc, /checkRateLimit/);
assert.match(routeSrc, /byok-ollama-models:ip:/);
assert.match(routeSrc, /byok-ollama-models:user:/);
assert.match(routeSrc, /BYOK_OLLAMA_PROBE_ERROR_NB/);
assert.match(routeSrc, /probeFailure\(\)/);
assert.doesNotMatch(routeSrc, /BYOK_BASE_URL_REJECTED_NB/);
assert.doesNotMatch(routeSrc, /BYOK_OLLAMA_UNREACHABLE_NB/);
assert.doesNotMatch(routeSrc, /throw error/);

assert.equal(BYOK_OLLAMA_PROBE_HTTP_STATUS, 400);
assert.match(BYOK_OLLAMA_PROBE_ERROR_NB, /\.$/);

console.log('app/api/byok/ollama/models/route.test.ts: ok');
