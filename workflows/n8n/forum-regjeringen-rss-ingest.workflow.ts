/**
 * Folkets Stemme – Forum Regjeringen RSS ingest (v12.1)
 * RSS Feed Trigger + RSS Read → parse/dedupe → insert clusters (status=pending).
 *
 * Webhook: POST folkets-forum-regjeringen-rss
 */
import { workflow, node, trigger, sticky, newCredential, ifElse } from '@n8n/workflow-sdk';
import { REGJERINGEN_DEDUP_CONTEXT_SQL } from './forum-workflow.shared';
import {
  REGJERINGEN_RSS_URL,
  REGJERINGEN_INGEST_JS,
  REGJERINGEN_BUILD_INSERT_JS,
  REGJERINGEN_LOG_EMPTY_JS,
} from './forum-regjeringen-ingest.shared';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 30 min',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '*/30 * * * *' }] },
    },
  },
  output: [{}],
});

const rssFeedTrigger = trigger({
  type: 'n8n-nodes-base.rssFeedReadTrigger',
  version: 1,
  config: {
    name: 'RSS Feed Trigger',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      feedUrl: REGJERINGEN_RSS_URL,
    },
  },
  output: [{ title: 'Eksempel', link: 'https://www.regjeringen.no/' }],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook manual',
    parameters: {
      path: 'folkets-forum-regjeringen-rss',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: {} }],
});

const fetchDedupContext = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch dedup context',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: REGJERINGEN_DEDUP_CONTEXT_SQL },
  },
  output: [{ existing_urls: [], recent_titles: [] }],
});

const rssRead = node({
  type: 'n8n-nodes-base.rssFeedRead',
  version: 1.2,
  config: {
    name: 'RSS Read',
    parameters: {
      url: REGJERINGEN_RSS_URL,
    },
  },
  output: [{ title: 'Eksempel', link: 'https://www.regjeringen.no/' }],
});

const parseRegjeringenRss = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Regjeringen RSS',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: REGJERINGEN_INGEST_JS,
    },
  },
  output: [{ story_title: 'Eksempel', articles: [] }],
});

const hasNewItems = ifElse({
  version: 2.2,
  config: {
    name: 'Has new items?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: "={{ !$json.skip_reason && !!$json.story_title }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const buildInsertQuery = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build insert query',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: REGJERINGEN_BUILD_INSERT_JS,
    },
  },
  output: [{ query: 'INSERT …', story_title: 'Eksempel' }],
});

const insertCluster = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Insert cluster',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: '={{ $json.query }}',
    },
  },
  output: [{ cluster_id: 'uuid', title: 'Eksempel', article_count: 1 }],
});

const logEmptyIngest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Log empty ingest',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: REGJERINGEN_LOG_EMPTY_JS,
    },
  },
});

sticky(
  '## Forum Regjeringen RSS v12.1\\n\\nRSS Feed Trigger (poll) + RSS Read node.\\nParse/dedupe → pending clusters. Schedule */30 + webhook.',
  [scheduleTrigger, rssFeedTrigger, webhookTrigger],
  { color: 4 }
);

const insertPipeline = buildInsertQuery.to(insertCluster);

const ingestPipeline = fetchDedupContext
  .to(rssRead)
  .to(parseRegjeringenRss)
  .to(hasNewItems.onTrue(insertPipeline).onFalse(logEmptyIngest));

export default workflow(
  'folkets-forum-regjeringen-rss',
  'Folkets Stemme – Forum Regjeringen RSS ingest (v12.1)'
)
  .add(rssFeedTrigger)
  .to(ingestPipeline)
  .add(scheduleTrigger)
  .to(ingestPipeline)
  .add(webhookTrigger)
  .to(ingestPipeline);
