import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB,
  BYOK_OLLAMA_BASE_URL_HINT_NB,
  ollamaBaseUrlHintNb,
} from './messages';

assert.match(BYOK_OLLAMA_BASE_URL_HINT_NB, /offentlig/);
assert.match(BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB, /^Offentlige http\(s\)-adresser fungerer alltid\./);
assert.match(BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB, /godkjentliste/);
assert.match(BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB, /serveren som kobler/);
assert.doesNotMatch(BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB, /BYOK_PRIVATE_URL_ALLOWLIST/);
assert.doesNotMatch(BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB, /192\.168/);

assert.equal(ollamaBaseUrlHintNb(false), BYOK_OLLAMA_BASE_URL_HINT_NB);
assert.equal(ollamaBaseUrlHintNb(true), BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB);

const byokSettingsSrc = readFileSync(
  join(process.cwd(), 'components/profile/byok-settings.tsx'),
  'utf8',
);
const minSideSrc = readFileSync(join(process.cwd(), 'app/dashboard/min-side/page.tsx'), 'utf8');
const stemmePlusSrc = readFileSync(
  join(process.cwd(), 'components/profile/profile-stemme-plus.tsx'),
  'utf8',
);

assert.doesNotMatch(byokSettingsSrc, /useIsAdmin/);
assert.match(byokSettingsSrc, /isAdmin/);
assert.match(byokSettingsSrc, /ollamaBaseUrlHintNb/);
assert.match(minSideSrc, /viewerIsAdmin/);
assert.match(minSideSrc, /isAdmin\(/);
assert.match(stemmePlusSrc, /isAdmin=\{isAdmin\}/);

console.log('lib/byok/messages.test.ts: ok');
