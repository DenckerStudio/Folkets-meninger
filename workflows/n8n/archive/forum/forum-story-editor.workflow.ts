/**
 * @deprecated v12 — validation merged into forum-prompt-generator.workflow.ts
 * Folkets Stemme – Forum story editor (v10 step 3)
 * Én AI-redaktør-agent. Ingen Code-noder.
 * Trigger: Execute Workflow (fra research) eller webhook POST folkets-forum-research-editor
 */
import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  outputParser,
  ifElse,
  expr,
} from '@n8n/workflow-sdk';
import {
  BUILD_EDITOR_TEXT_EXPR,
  EDITOR_SYSTEM,
  EXISTING_PROMPTS_FOR_EDITOR_SQL,
} from './forum-workflow.shared';

const editorOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Editor Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.1, format: 'json', numPredict: 1400, numCtx: 8192 },
    },
  },
});

const editorOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Editor JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"approved_prompts":[{"question":"Mener du …?","novelty_explanation":"…","source_indices":[0,1,2],"topic_tags":["politikk"],"sensitivity":"low","status":"draft"}],"rejected":[]}',
      autoFix: true,
    },
    subnodes: { model: editorOllamaModel },
  },
});

const executeWorkflowTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'When called by journalist',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'clusterId', type: 'string' },
          { name: 'candidate', type: 'object' },
          { name: 'sources_block', type: 'string' },
          { name: 'research', type: 'object' },
        ],
      },
    },
  },
  output: [{ clusterId: 'uuid', candidate: { question: 'Mener du …?' }, sources_block: '[0] …' }],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook editor',
    parameters: {
      path: 'folkets-forum-research-editor',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: { clusterId: 'uuid', candidate: {}, sources_block: '' } }],
});

const normalizeInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize input',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'cluster-id',
            name: 'clusterId',
            value: "={{ $json.clusterId || $json.body?.clusterId }}",
            type: 'string',
          },
          {
            id: 'candidate',
            name: 'candidate',
            value: '={{ $json.candidate || $json.body?.candidate }}',
            type: 'object',
          },
          {
            id: 'sources',
            name: 'sources_block',
            value: "={{ $json.sources_block || $json.body?.sources_block || '' }}",
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ clusterId: 'uuid', candidate: { question: 'Mener du …?' } }],
});

const fetchExistingPrompts = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch existing prompts',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: EXISTING_PROMPTS_FOR_EDITOR_SQL },
  },
  output: [{ existing_questions: [], max_sort_order: 3 }],
});

const fetchArticleSources = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch article sources',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ \"SELECT COALESCE(json_agg(json_build_object('title', a.title, 'url', a.url, 'outlet', a.outlet) ORDER BY a.sort_order), '[]'::json) AS source_headlines FROM public.forum_research_articles a WHERE a.cluster_id = '\" + $('Normalize input').first().json.clusterId + \"'::uuid\" }}",
    },
  },
  output: [{ source_headlines: [{ title: 'T', url: 'https://nrk.no/1', outlet: 'NRK' }] }],
});

const buildEditorPrompt = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Build editor prompt',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'editor-text',
            name: 'editorText',
            value: BUILD_EDITOR_TEXT_EXPR,
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ editorText: 'KANDIDAT...' }],
});

const editorAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Editor (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.editorText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: EDITOR_SYSTEM,
        maxIterations: 2,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: editorOllamaModel,
        outputParser: editorOutputParser,
      },
    },
  },
  output: [
    {
      output: {
        approved_prompts: [{ question: 'Mener du …?', source_indices: [0, 1, 2], status: 'draft' }],
        rejected: [],
      },
    },
  ],
});

const hasApproved = ifElse({
  version: 2.2,
  config: {
    name: 'Has approved prompt?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: '={{ ($json.output.approved_prompts || []).length }}',
            rightValue: 0,
            operator: { type: 'number', operation: 'gt' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const preparePromptInsert = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare prompt insert',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'question',
            name: 'question',
            value: '={{ $json.output.approved_prompts[0].question }}',
            type: 'string',
          },
          {
            id: 'topic-tags',
            name: 'topic_tags',
            value: '={{ $json.output.approved_prompts[0].topic_tags }}',
            type: 'array',
          },
          {
            id: 'sensitivity',
            name: 'sensitivity',
            value: "={{ $json.output.approved_prompts[0].sensitivity || 'low' }}",
            type: 'string',
          },
          {
            id: 'options',
            name: 'options',
            value:
              '={{ [{"id":"ja","label":"Ja"},{"id":"nei","label":"Nei"},{"id":"ikke_interessert","label":"Ikke interessert"}] }}',
            type: 'array',
          },
          {
            id: 'headlines',
            name: 'source_headlines',
            value: "={{ $('Fetch article sources').first().json.source_headlines }}",
            type: 'array',
          },
          {
            id: 'cluster-id',
            name: 'research_cluster_id',
            value: "={{ $('Normalize input').first().json.clusterId }}",
            type: 'string',
          },
          {
            id: 'sort',
            name: 'sort_order',
            value: "={{ ($('Fetch existing prompts').first().json.max_sort_order || 0) + 1 }}",
            type: 'number',
          },
        ],
      },
    },
  },
  output: [{ question: 'Mener du …?', options: [], source_headlines: [] }],
});

const insertForumPrompt = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Insert forum prompt',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'insert',
      schema: { __rl: true, mode: 'list', value: 'public' },
      table: { __rl: true, mode: 'list', value: 'forum_prompts' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          question: '={{ $json.question }}',
          options: '={{ $json.options }}',
          source_headlines: '={{ $json.source_headlines }}',
          topic_tags: '={{ $json.topic_tags }}',
          sensitivity: '={{ $json.sensitivity }}',
          status: 'draft',
          research_cluster_id: '={{ $json.research_cluster_id }}',
          sort_order: '={{ $json.sort_order }}',
        },
      },
    },
  },
  output: [{ id: 'uuid-prompt' }],
});

const markClusterDraft = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark cluster draft',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ \"UPDATE public.forum_research_clusters SET status = 'draft', processed_at = now(), updated_at = now() WHERE id = '\" + $('Normalize input').first().json.clusterId + \"'::uuid RETURNING id\" }}",
    },
  },
  output: [{ id: 'uuid' }],
});

const markClusterFailed = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark cluster failed',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ \"UPDATE public.forum_research_clusters SET status = 'failed', updated_at = now() WHERE id = '\" + $('Normalize input').first().json.clusterId + \"'::uuid AND status = 'processing' RETURNING id\" }}",
    },
  },
  output: [{ id: 'uuid' }],
});

sticky(
  '## Forum editor v10\\n\\nÉn redaktør-agent → forum_prompts draft. Kalles fra research via Execute Workflow.',
  [executeWorkflowTrigger, webhookTrigger],
  { color: 6 }
);

const editorBody = fetchExistingPrompts
  .to(fetchArticleSources)
  .to(buildEditorPrompt)
  .to(editorAgent)
  .to(
    hasApproved
      .onTrue(preparePromptInsert.to(insertForumPrompt).to(markClusterDraft))
      .onFalse(markClusterFailed)
  );

const editorPipeline = normalizeInput.to(
  hasValidEditorInput.onTrue(editorBody).onFalse(markClusterFailed)
);

export default workflow(
  'folkets-forum-research-editor',
  'Folkets Stemme – Forum story editor (v10)'
)
  .add(executeWorkflowTrigger)
  .to(editorPipeline)
  .add(webhookTrigger)
  .to(editorPipeline);
