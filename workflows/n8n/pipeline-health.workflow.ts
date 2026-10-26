/**
 * Daily pipeline health: backlog RPCs + deduped admin alerts (no embedding catch-up).
 */
import { expr, ifElse, newCredential, node, sticky, trigger, workflow } from '@n8n/workflow-sdk';
import {
  FOLKETS_AI_SUMMARY_WEBHOOK_CRED,
  FOLKETS_APP_BASE,
  FOLKETS_N8N_BASE,
  FOLKETS_SUPABASE_CRED,
  rpcUrl,
} from './n8n-supabase.shared';
import { createInWorkflowErrorNotify } from './in-workflow-error-notify';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 08:00 health',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * *' }] },
    },
  },
  output: [{}],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook pipeline health',
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-pipeline-health',
      responseMode: 'onReceived',
    },
  },
  output: [{}],
});

const fetchPipelineHealth = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch pipeline health',
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_pipeline_health'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{}',
      options: { timeout: 60000 },
    },
  },
  output: [],
});

const fetchEmbeddingBacklogHealth = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch embedding backlog health',
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_embedding_backlog_health'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{}',
      options: { timeout: 60000 },
    },
  },
  output: [],
});

const summarizeHealth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Summarize health',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `function asRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return [raw];
  return [];
}
function rowsFrom(name) {
  try {
    return $(name).all().flatMap((item) => asRows(item.json));
  } catch (_) {
    return [];
  }
}
function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
const staticData = $getWorkflowStaticData('global');
const pipelineItems = rowsFrom('Fetch pipeline health');
const backlogItems = rowsFrom('Fetch embedding backlog health');
const pipeline = pipelineItems[0] ?? {};
const backlog = backlogItems[0] ?? {};
const pipelineOk = pipelineItems.length > 0 && Object.keys(pipeline).length > 0;
const backlogOk = backlogItems.length > 0 && Object.keys(backlog).length > 0;

const missingSummaries = num(pipeline.summary_queue_depth ?? pipeline.missing_summaries);
const draftPolls = num(pipeline.draft_polls);
const pendingChunks = num(backlog.pending_v2_total ?? backlog.pending_legacy_total);
const oldestActive = num(backlog.oldest_pending_active_age_s);
const failedV2 = num(backlog.failed_v2);
const pendingV2 = num(backlog.pending_v2_total);

const prevFailed = num(staticData.lastFailedV2);
const failedIncreasing = backlogOk && failedV2 > prevFailed;

const now = Date.now();
if (!staticData.pendingV2Sample || typeof staticData.pendingV2Sample !== 'object') {
  staticData.pendingV2Sample = { value: pendingV2, at: now };
}
let pendingStalled = false;
const sample = staticData.pendingV2Sample;
const twentyHoursMs = 20 * 60 * 60 * 1000;
if (backlogOk && pendingV2 > 0 && now - Number(sample.at || 0) >= twentyHoursMs) {
  if (pendingV2 >= num(sample.value)) pendingStalled = true;
  staticData.pendingV2Sample = { value: pendingV2, at: now };
} else if (pendingV2 < num(sample.value)) {
  staticData.pendingV2Sample = { value: pendingV2, at: now };
}

const firstMissingId = String(pipeline.first_summary_queue_issue_id ?? '').trim();
const needsSummaryCatchup = Boolean(firstMissingId);

const reasons = [];
if (!pipelineOk) reasons.push('pipeline_health_rpc_failed');
if (!backlogOk) reasons.push('embedding_backlog_health_rpc_failed');
if (oldestActive > 1800) reasons.push('oldest_pending_active_age_s=' + oldestActive);
if (failedIncreasing) reasons.push('failed_v2_increasing');
if (pendingStalled) reasons.push('pending_v2_total_stalled_20h');
if (missingSummaries >= 15) reasons.push('summary_queue_depth>=' + missingSummaries);
if (draftPolls >= 8) reasons.push('draft_polls>=' + draftPolls);

const reasonKey = reasons.slice().sort().join('|');
const lastAlertAt = num(staticData.lastAlertAt);
const lastReasons = String(staticData.lastReasons || '');
const needsAlert =
  reasons.length > 0 &&
  (reasonKey !== lastReasons || now - lastAlertAt >= 24 * 60 * 60 * 1000);

if (needsAlert) {
  staticData.lastAlertAt = now;
  staticData.lastReasons = reasonKey;
}
staticData.lastFailedV2 = failedV2;

const subject =
  'Pipeline-status: ' +
  pendingChunks +
  ' v2-pending, ' +
  missingSummaries +
  ' sammendrag, ' +
  draftPolls +
  ' utkast';
const text = [
  'Folkets Meninger n8n-pipeline',
  '',
  'pending_v2_total: ' + pendingV2 + (backlog.pending_v2_total_is_estimate ? ' (estimat)' : ''),
  'oldest_pending_active_age_s: ' + oldestActive,
  'failed_v2: ' + failedV2,
  'Sammendrag-kø (summary_queue_depth): ' + missingSummaries,
  'System-poll utkast: ' + draftPolls,
  reasons.length ? ('Varselgrunner: ' + reasons.join(', ')) : 'Ingen varselgrunner',
  '',
  draftPolls ? 'Publiser utkast: https://www.folkets-meninger.no/dashboard/admin/vurder?fane=reels' : null,
].filter(Boolean).join('\\n');

return [{
  json: {
    pendingChunks,
    missingSummaries,
    draftPolls,
    firstMissingId,
    needsSummaryCatchup,
    needsAlert,
    subject,
    text,
    meta: {
      pendingChunks,
      missingSummaries,
      draftPolls,
      oldestPendingActiveAgeS: oldestActive,
      failedV2,
      pendingV2Total: pendingV2,
      alertReasons: reasons,
    },
  },
}];`,
    },
  },
  output: [
    {
      pendingChunks: 0,
      missingSummaries: 0,
      draftPolls: 0,
      firstMissingId: '',
      needsSummaryCatchup: false,
      needsAlert: false,
    },
  ],
});

const needsSummaryCatchup = ifElse({
  version: 2.2,
  config: {
    name: 'Needs summary catch-up?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'summary-catchup',
            leftValue: expr("{{ $('Summarize health').item.json.needsSummaryCatchup }}"),
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
      },
    },
  },
});

const triggerSummaries = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Catch-up AI summaries',
    onError: 'continueRegularOutput',
    credentials: { httpHeaderAuth: newCredential(FOLKETS_AI_SUMMARY_WEBHOOK_CRED) },
    parameters: {
      method: 'POST',
      url: `${FOLKETS_N8N_BASE}/webhook/folkets-ai-summary`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ stortinget_issue_id: $("Summarize health").item.json.firstMissingId }) }}',
      ),
      options: { timeout: 15000 },
    },
  },
  output: [{ ok: true }],
});

const needsAlert = ifElse({
  version: 2.2,
  config: {
    name: 'Needs admin alert?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'alert',
            leftValue: expr("{{ $('Summarize health').item.json.needsAlert }}"),
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
      },
    },
  },
});

const notifySettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Notify settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'cron-secret', name: 'cronSecret', value: '', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronSecret: '' }],
});

const notifyAdmin = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Varsle admin',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: `${FOLKETS_APP_BASE}/api/ops/n8n-notify`,
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'x-cron-secret', value: expr("{{ $('Notify settings').item.json.cronSecret }}") }],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ kind: "health", subject: $("Summarize health").item.json.subject, text: $("Summarize health").item.json.text, meta: $("Summarize health").item.json.meta }) }}',
      ),
      options: { timeout: 30000 },
    },
  },
  output: [{ ok: true }],
});

const logHealthy = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log healthy',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'outcome', name: 'outcome', value: 'healthy', type: 'string' },
        ],
      },
    },
  },
  output: [{ outcome: 'healthy' }],
});

const inWorkflowError = createInWorkflowErrorNotify('folkets-pipeline-health');

sticky(
  '## Pipeline-helse\n\nDaglig 08:00 + webhook. Leser `n8n_pipeline_health` og `n8n_embedding_backlog_health` (ingen global embedding catch-up). Varsler ved endrede grunner eller etter 24t. Fyll inn cronSecret.',
  [scheduleTrigger, webhookTrigger],
  { color: 3 },
);

const alertPath = needsAlert.onTrue(notifySettings.to(notifyAdmin)).onFalse(logHealthy);
const summaryCatchupPath = needsSummaryCatchup.onTrue(triggerSummaries.to(alertPath)).onFalse(alertPath);

const healthBody = fetchPipelineHealth.to(fetchEmbeddingBacklogHealth).to(summarizeHealth).to(summaryCatchupPath);

export default workflow(
  'folkets-pipeline-health',
  'Folkets Meninger – pipeline-helse',
)
  .add(scheduleTrigger)
  .to(healthBody)
  .add(webhookTrigger)
  .to(healthBody)
  .add(inWorkflowError.errorTrigger)
  .to(inWorkflowError.formatError.to(inWorkflowError.notifySettings).to(inWorkflowError.notifyAdmin));
