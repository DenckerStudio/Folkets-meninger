import assert from 'node:assert/strict';
import {
  buildRedditSearchRssUrl,
  redditLinkClusterKeyHint,
} from '@/workflows/n8n/action-capture-reddit.shared';

assert.match(buildRedditSearchRssUrl('ki opprop'), /search\.rss\?q=/);

assert.equal(
  redditLinkClusterKeyHint({
    sourceType: 'reddit',
    urlCanonical: 'https://www.adressa.no/nyheter/sak-1',
    actionSlug: null,
  }),
  'link-adressa.no/nyheter/sak-1',
);

assert.equal(
  redditLinkClusterKeyHint({
    sourceType: 'reddit',
    urlCanonical: 'https://www.reddit.com/r/norge/comments/abc/t/',
    actionSlug: null,
  }),
  null,
);

console.log('workflows/n8n/action-capture-reddit.shared.test.ts: ok');
