import assert from 'node:assert/strict';
import { formatOppfangetConfidence } from '@/lib/admin/oppfanget/format-confidence';

assert.match(formatOppfangetConfidence(0.82), /82.*% sikker/);
assert.match(formatOppfangetConfidence(0.821), /82/);

console.log('admin/oppfanget/format-confidence.test.ts: ok');
