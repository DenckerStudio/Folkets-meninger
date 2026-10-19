import assert from 'node:assert/strict';
import { formatOppfangetConfidence } from '@/lib/admin/oppfanget/format-confidence';

assert.equal(formatOppfangetConfidence(0.82), '82\u00a0%');
assert.match(formatOppfangetConfidence(0.821), /82/);

console.log('admin/oppfanget/format-confidence.test.ts: ok');
