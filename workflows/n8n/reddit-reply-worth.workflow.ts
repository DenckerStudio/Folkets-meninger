/**
 * Folkets Meninger – score Reddit signals for «verdt å svare» (reply_worth).
 *
 * Schedule: every 15 minutes. List candidates → gate → Ollama JSON → set RPC.
 * Deploy via owner process (do not import JSON to prod from this agent).
 */
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
import { FOLKETS_SUPABASE_CRED, rpcUrl } from './n8n-supabase.shared';
import { createInWorkflowErrorNotify } from './in-workflow-error-notify';
import {
  APPLY_REPLY_WORTH_GATE_JS,
  BUILD_REPLY_WORTH_PROMPT_JS,
  EXPAND_REPLY_WORTH_CANDIDATES_JS,
  MAP_REPLY_WORTH_OUTPUT_JS,
  REPLY_WORTH_SYSTEM_MESSAGE,
} from './reddit-reply-worth.shared';

const ollamaChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Reply-worth Ollama',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'gemma4:26b',
      options: {
        think: false,
        temperature: 0.15,
        format: 'json',
        numPredict: 200,
        numCtx: 4096,
      },
    },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 15 minutes',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 15 }],
      },
    },
  },
  output: [{}],
});

const batchSettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Batch settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'batch-limit', name: 'batchLimit', value: '5', type: 'string' },
        ],
      },
    },
  },
  output: [{ batchLimit: '5' }],
});

const fetchCandidates = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch reply-worth candidates',
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 3000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_list_reddit_reply_worth_candidates'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_limit: Number($("Batch settings").item.json.batchLimit || 5) }) }}',
      ),
      options: { timeout: 30000 },
    },
  },
  output: [
    {
      reddit_id: 'abc123',
      subreddit: 'norge',
      title: 'Hvorfor varsler folk stadig?',
      score: 42,
      num_comments: 17,
      status: 'ny',
    },
  ],
});

const expandCandidates = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand candidates',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: EXPAND_REPLY_WORTH_CANDIDATES_JS,
    },
  },
  output: [{ reddit_id: 'abc123', title: 'Eksempel' }],
});

const processOne = splitInBatches({
  version: 3,
  config: {
    name: 'Process one signal',
    parameters: { batchSize: 1 },
  },
});

const applyGate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Apply reply-worth gate',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: APPLY_REPLY_WORTH_GATE_JS,
    },
  },
  output: [{ reddit_id: 'abc123', gatePass: true }],
});

const gatePass = ifElse({
  version: 2.2,
  config: {
    name: 'Gate pass?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'gate-pass',
            leftValue: expr('{{ $json.gatePass }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true' },
          },
        ],
      },
    },
  },
});

const writeSkipped = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Write skipped',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_set_reddit_reply_worth'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        `={{ JSON.stringify({
          p_reddit_id: $json.reddit_id,
          p_status: 'skipped',
          p_worth: null,
          p_reason: $json.skipReason || 'gate',
          p_model: null,
          p_gate_passes: false
        }) }}`,
      ),
      options: { timeout: 30000 },
    },
  },
  output: [{ ok: true }],
});

const buildPrompt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build prompt',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: BUILD_REPLY_WORTH_PROMPT_JS,
    },
  },
  output: [{ reddit_id: 'abc123', promptText: '…' }],
});

const scoreAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 2.2,
  config: {
    name: 'Score reply worth',
    parameters: {
      promptType: 'define',
      text: expr('={{ $json.promptText }}'),
      options: {
        systemMessage: REPLY_WORTH_SYSTEM_MESSAGE,
      },
      hasOutputParser: false,
    },
    subnodes: {
      model: ollamaChatModel,
    },
  },
  output: [{ output: '{"worth":4,"reason":"Åpent spørsmål"}' }],
});

const mapOutput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map score output',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: MAP_REPLY_WORTH_OUTPUT_JS,
    },
  },
  output: [{ reddit_id: 'abc123', worth: 4, setStatus: 'scored' }],
});

const writeScore = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Write reply worth',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_set_reddit_reply_worth'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        `={{ JSON.stringify({
          p_reddit_id: $json.reddit_id,
          p_status: $json.setStatus,
          p_worth: $json.worth,
          p_reason: $json.reason,
          p_model: $json.model,
          p_gate_passes: true
        }) }}`,
      ),
      options: { timeout: 30000 },
    },
  },
  output: [{ ok: true }],
});

const batchDone = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Batch complete',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          {
            id: 'status',
            name: 'status',
            value: 'reply_worth_batch_complete',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ status: 'reply_worth_batch_complete' }],
});

const scorePath = buildPrompt
  .to(scoreAgent)
  .to(mapOutput)
  .to(writeScore)
  .to(nextBatch(processOne));

const skipPath = writeSkipped.to(nextBatch(processOne));

const perSignal = applyGate.to(gatePass.onTrue(scorePath).onFalse(skipPath));

const inWorkflowError = createInWorkflowErrorNotify('reddit-reply-worth');

sticky(
  '## Reddit reply_worth\n\n1. Krever migrasjon `20261122140000_reddit_reply_worth.sql`.\n2. Scorer kun metadata (aldri trådtekst/forfatter).\n3. Deploy manuelt — ikke importer JSON til prod herfra.',
  [scheduleTrigger],
  { color: 5 },
);

export default workflow('reddit-reply-worth', 'Reddit svarverdi (reply_worth)')
  .add(scheduleTrigger)
  .to(batchSettings)
  .to(fetchCandidates)
  .to(expandCandidates)
  .to(processOne.onDone(batchDone).onEachBatch(perSignal))
  .add(inWorkflowError.errorTrigger)
  .to(
    inWorkflowError.formatError
      .to(inWorkflowError.notifySettings)
      .to(inWorkflowError.notifyAdmin),
  );
