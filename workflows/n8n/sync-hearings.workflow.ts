/**
 * Folkets Meninger – Sync Stortinget hearings (n8n schedule → app cron)
 *
 * Calls GET /api/cron/sync-hearings with x-cron-secret. Upserts
 * stortinget_hearings + hearing_documents and chunks høringsprogram text.
 * PDF/sak_publikasjon conversion is handled by a separate docling workflow.
 */
import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';
import { createInWorkflowErrorNotify } from './in-workflow-error-notify';

const CALL_SYNC_HEARINGS_JS = `const settings = $('Cron settings (sync-hearings)').first()?.json ?? {};
const baseUrl = String(settings.appBaseUrl || '').replace(/\\\\/$/, '');
const secret = String(settings.cronSecret || '').trim();
if (!baseUrl || !secret) {
  throw new Error('Missing appBaseUrl or cronSecret in Cron settings (sync-hearings)');
}
const res = await this.helpers.httpRequest({
  method: 'GET',
  url: baseUrl + '/api/cron/sync-hearings',
  headers: { 'x-cron-secret': secret },
  timeout: 600000,
  json: true,
});
return [{ json: { ok: true, response: res } }];
`;

const cronSettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Cron settings (sync-hearings)',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          {
            id: 'app-base-url',
            name: 'appBaseUrl',
            value: 'https://www.folkets-meninger.no',
            type: 'string',
          },
          {
            id: 'cron-secret',
            name: 'cronSecret',
            value: '',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ appBaseUrl: 'https://www.folkets-meninger.no', cronSecret: '' }],
});

const callSync = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Call sync-hearings',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: CALL_SYNC_HEARINGS_JS,
    },
  },
  output: [{ ok: true, response: { ok: true, hearingsUpserted: 0 } }],
});

const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 03:30 sync-hearings',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '30 3 * * *' }] },
    },
  },
  output: [{}],
});

const inWorkflowError = createInWorkflowErrorNotify('folkets-sync-hearings');

sticky(
  '## Sync høringer\\n\\nFyll **cronSecret** og **appBaseUrl** i Cron settings. Kjører etter sync-issues og fyller `stortinget_hearings` + `hearing_documents`. Docling-workflow konverterer `pending` PDF-er.',
  [schedule],
  { color: 4 },
);

export default workflow('folkets-sync-hearings', 'Folkets Meninger – Sync høringer (n8n)')
  .add(schedule)
  .to(cronSettings.to(callSync))
  .add(inWorkflowError.errorTrigger)
  .to(inWorkflowError.formatError.to(inWorkflowError.notifySettings).to(inWorkflowError.notifyAdmin));
