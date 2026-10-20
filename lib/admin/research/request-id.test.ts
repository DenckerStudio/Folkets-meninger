import assert from 'node:assert/strict';
import { parseClientResearchRequestId } from '@/lib/admin/research/request-id';

const id = '550e8400-e29b-41d4-a716-446655440000';
assert.equal(parseClientResearchRequestId({ request_id: id }), id);
assert.equal(parseClientResearchRequestId({ request_id: '  ' }), null);
assert.equal(parseClientResearchRequestId({ request_id: 'not-a-uuid' }), null);
assert.equal(parseClientResearchRequestId(null), null);

console.log('admin/research/request-id.test.ts: ok');
