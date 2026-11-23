/**
 * Hourly Traefik access-log aggregates → n8n_upsert_analytics_http_daily.
 *
 * Coolify Expert must wire real log reading (SSH/volume) before publishing.
 * Do not import into prod without the owner deploy process.
 *
 * Retention purge lives in a separate draft workflow
 * (`analytics-events-retention.workflow.ts`) so HTTP aggregates can go live
 * without scheduling deletion.
 */
import { expr, newCredential, node, sticky, trigger, workflow } from '@n8n/workflow-sdk';
import { FOLKETS_SUPABASE_CRED, rpcUrl } from './n8n-supabase.shared';
import { createInWorkflowErrorNotify } from './in-workflow-error-notify';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Hourly analytics HTTP',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '15 * * * *' }] },
    },
  },
  output: [{}],
});

/**
 * Placeholder: replace with Execute Command / read log files on klever.
 * Emits empty p_rows until Coolify Expert completes access-log wiring
 * (see infra/coolify/access-log-metrics.md).
 */
const buildEmptyHttpRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build empty HTTP rows (stub)',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `return [{ json: { p_rows: [] } }];`,
    },
  },
  output: [{ p_rows: [] }],
});

const upsertHttpDaily = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Upsert analytics_http_daily',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_upsert_analytics_http_daily'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ p_rows: $json.p_rows || [] }) }}'),
      options: { timeout: 60000 },
    },
  },
  output: [],
});

const inWorkflowError = createInWorkflowErrorNotify('folkets-analytics-http-daily');

sticky(
  '## Analytics HTTP daily\n\n1. Apply migration `20261122130000`.\n2. Replace **Build empty HTTP rows** with real Traefik parse (`infra/coolify/access-log-metrics.md`).\n3. Publish only after Mathias approves.\n4. Retention purge is a **separate** draft: `analytics-events-retention.workflow.ts`.',
  [scheduleTrigger],
  { color: 3 },
);

export default workflow(
  'folkets-analytics-http-daily',
  'Folkets Meninger – analytics HTTP daily',
)
  .add(scheduleTrigger)
  .to(buildEmptyHttpRows.to(upsertHttpDaily))
  .add(inWorkflowError.errorTrigger)
  .to(inWorkflowError.formatError.to(inWorkflowError.notifySettings).to(inWorkflowError.notifyAdmin));
