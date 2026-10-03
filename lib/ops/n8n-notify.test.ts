import assert from 'node:assert/strict';
import { opsAlertRecipient, parseN8nNotifyPayload } from './n8n-notify';

assert.equal(parseN8nNotifyPayload(null), null);
assert.equal(parseN8nNotifyPayload({ subject: 'x' }), null);

const parsed = parseN8nNotifyPayload({
  kind: 'health',
  subject: '  Kø i embeddings  ',
  text: '12 pending chunks',
  meta: { pending: 12 },
});
assert.deepEqual(parsed, {
  kind: 'health',
  subject: 'Kø i embeddings',
  text: '12 pending chunks',
  meta: { pending: 12 },
});

const fallback = parseN8nNotifyPayload({
  subject: 'n8n-feil: App cron',
  text: 'HTTP 500',
});
assert.equal(fallback?.kind, 'error');

const originalOps = process.env.OPS_ALERT_EMAIL;
const originalFeedback = process.env.FEEDBACK_INBOX_EMAIL;
delete process.env.OPS_ALERT_EMAIL;
delete process.env.FEEDBACK_INBOX_EMAIL;
assert.equal(opsAlertRecipient(), 'kontakt@folketsstemme.no');
process.env.OPS_ALERT_EMAIL = 'ops@folkets-stemme.no';
assert.equal(opsAlertRecipient(), 'ops@folkets-stemme.no');
if (originalOps === undefined) delete process.env.OPS_ALERT_EMAIL;
else process.env.OPS_ALERT_EMAIL = originalOps;
if (originalFeedback === undefined) delete process.env.FEEDBACK_INBOX_EMAIL;
else process.env.FEEDBACK_INBOX_EMAIL = originalFeedback;

console.log('n8n notify payload tests OK');
