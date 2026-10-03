import assert from 'node:assert/strict';
import { parseOpsNotifyPayload } from './ops-notify';
import { normalizePipelineHealth, pipelineHealthNeedsAttention } from './pipeline-health';

assert.deepEqual(parseOpsNotifyPayload(null), { error: 'Ugyldig JSON' });
assert.deepEqual(parseOpsNotifyPayload({ kind: 'nope', subject: 'x', text: 'y' }), {
  error: 'Ugyldig kind',
});
assert.deepEqual(parseOpsNotifyPayload({ kind: 'error', subject: '', text: 'y' }), {
  error: 'Mangler subject eller text',
});

const parsed = parseOpsNotifyPayload({
  kind: 'hearing',
  subject: 'Motforslag',
  text: 'Rapport',
  meta: { sakId: '200329' },
});
assert.ok(!('error' in parsed));
if (!('error' in parsed)) {
  assert.equal(parsed.kind, 'hearing');
  assert.equal(parsed.meta.sakId, '200329');
}

const health = normalizePipelineHealth({
  pending_chunks: '3',
  missing_summaries: 2,
  thin_summaries: 0,
  draft_polls: 1,
  recent_ops_events: 4,
});
assert.deepEqual(health, {
  pendingChunks: 3,
  missingSummaries: 2,
  thinSummaries: 0,
  draftPolls: 1,
  recentOpsEvents: 4,
});
assert.equal(pipelineHealthNeedsAttention(health), false);
assert.equal(
  pipelineHealthNeedsAttention({ ...health, pendingChunks: 40 }),
  true,
);

console.log('n8n ops notify tests passed');
