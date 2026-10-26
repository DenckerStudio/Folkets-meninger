import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  splitInBatches,
  nextBatch,
  expr,
  ifElse,
} from '@n8n/workflow-sdk';
import {
  FOLKETS_AI_SUMMARY_WEBHOOK_HEADER_CRED,
  FOLKETS_SUPABASE_CRED,
  FOLKETS_SUPABASE_REST,
  rpcUrl,
} from './n8n-supabase.shared';
import { createInWorkflowErrorNotify } from './in-workflow-error-notify';
import {
  ATTACH_EXTRA_CONTEXT_SCHEDULE_JS,
  ATTACH_EXTRA_CONTEXT_WEBHOOK_JS,
  BUILD_SAK_CONTEXT_JS,
  EXPAND_OR_EMPTY_JS,
  HASH_GATE_WEBHOOK_JS,
  MAP_SUMMARY_OUTPUT_JS,
  PREPARE_UPSERT_SQL_JS,
  STORE_GENERATION_HASH_SCHEDULE_JS,
  STORE_GENERATION_HASH_WEBHOOK_JS,
  SUMMARY_SYSTEM_MESSAGE,
} from './n8n-pipeline.shared';

const ollamaChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'gemma4:26b',
      options: {
        think: false,
        temperature: 0.2,
        format: 'json',
        numPredict: 2200,
        numCtx: 16384,
      },
    },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 30 minutes',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 30 }],
      },
    },
  },
  output: [{}],
});

const backfillSettingsSchedule = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Backfill settings (schedule)',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'batch-limit', name: 'batchLimit', value: '1', type: 'string' },
        ],
      },
    },
  },
  output: [{ batchLimit: '1' }],
});

const fetchMissingSummaries = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch issues without summary',
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 3000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_list_issues_missing_ai_summary'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_limit: Number($("Backfill settings (schedule)").item.json.batchLimit || 1) }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      summary: 'Kort tittel',
      ai_summary_source_context: 'Innstillingstekst',
    },
  ],
});

const expandMissingIssues = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand missing issues',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: EXPAND_OR_EMPTY_JS,
    },
  },
  output: [{ id: '200329', title: 'Example sak' }],
});

const processOneIssue = splitInBatches({
  version: 3,
  config: {
    name: 'Process one issue',
    parameters: { batchSize: 1 },
  },
});

const buildSakContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build sak context',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: BUILD_SAK_CONTEXT_JS,
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      sakContextText: 'Sak ID: 200329\nTittel: Example',
      contextChars: 32,
    },
  ],
});

const hasUsableContext = ifElse({
  version: 2.2,
  config: {
    name: 'Has usable context?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-id',
            leftValue: expr('{{ $json.id }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
          {
            id: 'enough-context',
            leftValue: expr('{{ $json.contextChars }}'),
            rightValue: 40,
            operator: { type: 'number', operation: 'gt' },
          },
        ],
      },
    },
  },
});

const loadIssueSource = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Load issue source',
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'GET',
      url: expr(
        `={{ '${FOLKETS_SUPABASE_REST}/stortinget_issues?id=eq.' + encodeURIComponent($('Process one issue').item.json.id) + '&select=id,title,summary,henvisning,ai_summary_source_context,ai_summary_source_hash' }}`,
      ),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      options: { timeout: 60000 },
    },
  },
  output: [{ id: '200329', title: 'Example sak', ai_summary_source_context: 'Kontekst' }],
});

const loadDocumentChunks = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Load document chunks',
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'GET',
      url: expr(
        `={{ '${FOLKETS_SUPABASE_REST}/document_chunks?issue_id=eq.' + encodeURIComponent($('Process one issue').item.json.id) + '&select=document_id,chunk_index,content&order=document_id.asc,chunk_index.asc&limit=80' }}`,
      ),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      options: { timeout: 60000 },
    },
  },
  output: [{ document_id: 'doc-1', chunk_index: 0, content: 'Utdrag' }],
});

const attachExtraContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Attach extra context',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: ATTACH_EXTRA_CONTEXT_SCHEDULE_JS,
    },
  },
  output: [{ id: '200329', title: 'Example sak', document_chunks: [] }],
});

const generateSummaryAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate summary (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.sakContextText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: SUMMARY_SYSTEM_MESSAGE,
        maxIterations: 4,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
      },
    },
  },
  output: [{ output: { hva: 'Sakens innhold', hvem: 'Berørte', kostnad: 'Ikke omtalt' } }],
});

const mapAgentOutput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map agent output',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: MAP_SUMMARY_OUTPUT_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Ikke omtalt i kilden.',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: '',
      topic_cards: [],
      labels: ['Skatt'],
    },
  ],
});

const prepareUpsertSql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare upsert SQL',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: PREPARE_UPSERT_SQL_JS,
    },
  },
  output: [{ issueId: '200329', hva: 'Sakens innhold', gen_meta: { model: 'gemma4:26b' } }],
});

const hasIssueIdToSave = ifElse({
  version: 2.2,
  config: {
    name: 'Has issue id to save?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-issue',
            leftValue: expr('{{ $json.issueId }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
      },
    },
  },
});

const saveSummaryToDb = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Save summary to Supabase',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_upsert_issue_ai_summary'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $json.issueId, p_hva: $json.hva, p_hvem: $json.hvem, p_kostnad: $json.kostnad, p_narrative: $json.narrative || $json.hva, p_who_affected: $json.who_affected || $json.hvem, p_how_affected: $json.how_affected || "", p_topic_cards: $json.topic_cards || [], p_labels: $json.labels || [] }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [{ ok: true }],
});

const storeGenerationHash = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Store generation hash',
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: STORE_GENERATION_HASH_SCHEDULE_JS,
    },
  },
  output: [{ issueId: '200329', hashStored: true }],
});

const logSkippedSave = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log skipped save',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'outcome', name: 'outcome', value: 'skipped', type: 'string' },
          {
            id: 'message',
            name: 'message',
            value: 'Skipped AI summary save (no issue id)',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ outcome: 'skipped' }],
});

const logSummaryResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log summary result',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'issue-id',
            name: 'issueId',
            value: expr('{{ $("Map agent output").item.json.issueId }}'),
            type: 'string',
          },
          { id: 'saved', name: 'saved', value: true, type: 'boolean' },
          { id: 'outcome', name: 'outcome', value: 'saved', type: 'string' },
        ],
      },
    },
  },
  output: [{ issueId: '200329', saved: true, outcome: 'saved' }],
});

const logSkipSummary = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log skipped summary',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'outcome', name: 'outcome', value: 'skipped', type: 'string' },
          {
            id: 'message',
            name: 'message',
            value: 'Skipped AI summary (empty queue, thin context, or invalid model output)',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ outcome: 'skipped' }],
});

const rateLimitPause = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Rate limit pause',
    parameters: {
      resume: 'timeInterval',
      amount: 5,
      unit: 'seconds',
    },
  },
});

const batchRunComplete = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Batch run complete',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'scheduled_backfill_complete', type: 'string' },
          { id: 'at', name: 'completedAt', value: expr('{{ $now.toISO() }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{ status: 'scheduled_backfill_complete' }],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook new issue',
    credentials: { httpHeaderAuth: newCredential(FOLKETS_AI_SUMMARY_WEBHOOK_HEADER_CRED) },
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-ai-summary',
      responseMode: 'onReceived',
      authentication: 'headerAuth',
      options: { responseCode: { values: { responseCode: 'customCode', customCode: 202 } }, responseData: '{"ok":true,"queued":true}' },
      // Header Auth (X-FM-Webhook-Token) på denne noden er bevisst IKKE aktivert i repo ennå.
      // Se utrulling steg 4 i workflows/n8n/README.md (etter fm-web har N8N_AI_SUMMARY_WEBHOOK_TOKEN + deploy).
    },
  },
  output: [{ body: { stortinget_issue_id: '200329' } }],
});

const normalizeIssueId = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize issue ID',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'issue-id',
            name: 'id',
            value: expr(
              '{{ $json.body?.stortinget_issue_id ?? $json.body?.id ?? $json.stortinget_issue_id ?? $json.id }}',
            ),
            type: 'string',
          },
          {
            id: 'force',
            name: 'force',
            value: expr(
              "{{ $json.body?.force === true || $json.body?.force === 'true' || $json.query?.force === 'true' }}",
            ),
            type: 'boolean',
          },
        ],
      },
    },
  },
  output: [{ id: '200329', force: false }],
});

const fetchIssueById = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch issue by ID',
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'GET',
      url: expr(
        `={{ '${FOLKETS_SUPABASE_REST}/stortinget_issues?id=eq.' + encodeURIComponent($json.id) + '&select=id,title,summary,henvisning,ai_summary_source_context,ai_summary_source_hash' }}`,
      ),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      options: { timeout: 60000 },
    },
  },
  output: [{ id: '200329', title: 'Example sak', ai_summary_source_context: 'Kontekst' }],
});

const loadDocumentChunksWebhook = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Load document chunks (webhook)',
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'GET',
      url: expr(
        `={{ '${FOLKETS_SUPABASE_REST}/document_chunks?issue_id=eq.' + encodeURIComponent($('Fetch issue by ID').item.json.id) + '&select=document_id,chunk_index,content&order=document_id.asc,chunk_index.asc&limit=80' }}`,
      ),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      options: { timeout: 60000 },
    },
  },
  output: [{ document_id: 'doc-1', chunk_index: 0, content: 'Utdrag' }],
});

const attachExtraContextWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Attach extra context (webhook)',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: ATTACH_EXTRA_CONTEXT_WEBHOOK_JS,
    },
  },
  output: [{ id: '200329', title: 'Example sak', document_chunks: [] }],
});

const buildSakContextWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build sak context (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: BUILD_SAK_CONTEXT_JS,
    },
  },
  output: [{ id: '200329', sakContextText: 'Sak ID: 200329', contextChars: 18 }],
});

const hashGateWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Hash gate (webhook)',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: HASH_GATE_WEBHOOK_JS,
    },
  },
  output: [{ id: '200329', regenerate: true, gate_reason: 'no_previous_hash', contextChars: 18 }],
});

const shouldRegenerateWebhook = ifElse({
  version: 2.2,
  config: {
    name: 'Regenerate? (webhook)',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'regenerate',
            leftValue: expr('{{ $json.regenerate }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
      },
    },
  },
});

const logUnchangedWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Log unchanged (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `return { json: { ok: true, skipped: true, reason: $json.gate_reason || 'unchanged_context_hash', issueId: $json.id || '' } };`,
    },
  },
  output: [{ ok: true, skipped: true, reason: 'unchanged_context_hash' }],
});

const logWebhookSkipped = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Log skipped (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `return { json: { ok: true, skipped: true, reason: $json.reason || $json.gate_reason || 'skipped', issueId: $json.id || $json.rejectedIssueId || '' } };`,
    },
  },
  output: [{ ok: true, skipped: true, reason: 'skipped' }],
});

const generateSummaryAgentWebhook = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate summary (Ollama webhook)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.sakContextText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: SUMMARY_SYSTEM_MESSAGE,
        maxIterations: 4,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
      },
    },
  },
  output: [{ output: { hva: 'Sakens innhold', hvem: 'Berørte', kostnad: 'Ikke omtalt' } }],
});

const mapAgentOutputWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map agent output (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: MAP_SUMMARY_OUTPUT_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Ikke omtalt i kilden.',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: '',
      topic_cards: [],
      labels: ['Skatt'],
    },
  ],
});

const prepareUpsertSqlWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare upsert SQL (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: PREPARE_UPSERT_SQL_JS,
    },
  },
  output: [{ issueId: '200329', hva: 'Sakens innhold', gen_meta: { model: 'gemma4:26b' } }],
});

const hasWebhookIssueIdToSave = ifElse({
  version: 2.2,
  config: {
    name: 'Has webhook issue id to save?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-issue',
            leftValue: expr('{{ $json.issueId }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
      },
    },
  },
});

const storeGenerationHashWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Store generation hash (webhook)',
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: STORE_GENERATION_HASH_WEBHOOK_JS,
    },
  },
  output: [{ issueId: '200329', hashStored: true }],
});

const saveSummaryWebhook = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Save summary (webhook)',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_upsert_issue_ai_summary'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $json.issueId, p_hva: $json.hva, p_hvem: $json.hvem, p_kostnad: $json.kostnad, p_narrative: $json.narrative || $json.hva, p_who_affected: $json.who_affected || $json.hvem, p_how_affected: $json.how_affected || "", p_topic_cards: $json.topic_cards || [], p_labels: $json.labels || [] }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [{ ok: true }],
});

const inWorkflowError = createInWorkflowErrorNotify('folkets-ai-summary-backfill');

sticky(
  '## AI-sammendrag (Ollama)\n\nTom kø avbrytes uten Ollama-kall. Webhook henter sak + chunks via PostgREST GET. Hash-gate i workflow static data.\n\n**Ikke** generer sammendrag uten sak-id. Error Trigger POSTer til /api/ops/n8n-notify; app-kø: /api/cron/n8n-retry.',
  [scheduleTrigger, webhookTrigger],
  { color: 4 },
);

const afterSkippedSave = logSkippedSave.to(rateLimitPause).to(nextBatch(processOneIssue));

const savedSchedulePath = saveSummaryToDb
  .to(storeGenerationHash)
  .to(logSummaryResult)
  .to(rateLimitPause)
  .to(nextBatch(processOneIssue));

const saveOrSkipSchedule = hasIssueIdToSave.onTrue(savedSchedulePath).onFalse(afterSkippedSave);

const mapAndSaveSchedule = mapAgentOutput
  .to(prepareUpsertSql)
  .to(saveOrSkipSchedule);

const summaryPipeline = loadIssueSource
  .to(loadDocumentChunks)
  .to(attachExtraContext)
  .to(buildSakContext)
  .to(
    hasUsableContext
      .onTrue(generateSummaryAgent.to(mapAndSaveSchedule))
      .onFalse(logSkipSummary.to(nextBatch(processOneIssue))),
  );

const webhookSavedPath = saveSummaryWebhook.to(storeGenerationHashWebhook);

const webhookSaveOrSkip = hasWebhookIssueIdToSave
  .onTrue(webhookSavedPath)
  .onFalse(logWebhookSkipped);

const webhookMapAndSave = mapAgentOutputWebhook.to(prepareUpsertSqlWebhook).to(webhookSaveOrSkip);

const webhookGeneratePath = generateSummaryAgentWebhook.to(webhookMapAndSave);

const webhookAfterHashGate = shouldRegenerateWebhook
  .onTrue(webhookGeneratePath)
  .onFalse(logUnchangedWebhook);

export default workflow(
  'folkets-ai-summary-backfill',
  'Folkets Meninger – AI-sammendrag backfill',
)
  .add(scheduleTrigger)
  .to(backfillSettingsSchedule)
  .to(fetchMissingSummaries)
  .to(expandMissingIssues)
  .to(processOneIssue.onDone(batchRunComplete).onEachBatch(summaryPipeline))
  .add(webhookTrigger)
  .to(normalizeIssueId)
  .to(fetchIssueById)
  .to(loadDocumentChunksWebhook)
  .to(attachExtraContextWebhook)
  .to(buildSakContextWebhook)
  .to(hashGateWebhook)
  .to(webhookAfterHashGate)
  .add(inWorkflowError.errorTrigger)
  .to(inWorkflowError.formatError.to(inWorkflowError.notifySettings).to(inWorkflowError.notifyAdmin))
  .group('Hent manglende saker', [backfillSettingsSchedule, fetchMissingSummaries, expandMissingIssues], {
    description: 'RPC-kø for saker uten AI-sammendrag',
  });
