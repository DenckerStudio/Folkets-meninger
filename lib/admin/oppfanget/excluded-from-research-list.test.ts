import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPPFANGET_ACTION_TYPES_EXCLUDED_FROM_RESEARCH_LIST } from '@/lib/admin/oppfanget/excluded-from-research-list';

assert.deepEqual(OPPFANGET_ACTION_TYPES_EXCLUDED_FROM_RESEARCH_LIST, [
  'opprop',
  'demonstrasjon',
  'innsamling',
  'boykott',
  'kampanje',
]);

const serviceSrc = readFileSync(
  join(process.cwd(), 'lib/admin/oppfanget/service.ts'),
  'utf-8',
);
assert.match(serviceSrc, /OPPFANGET_ACTION_TYPES_EXCLUDED_FROM_RESEARCH_LIST/);
assert.match(serviceSrc, /OPPFANGET_ACTION_TYPES_EXCLUDED_FROM_RESEARCH_LIST\.includes/);

console.log('excluded-from-research-list.test.ts: ok');
