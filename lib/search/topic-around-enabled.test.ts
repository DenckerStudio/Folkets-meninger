import assert from 'node:assert/strict';
import { isTopicAroundSearchEnabled } from './topic-around-enabled';

const prev = { ...process.env };

try {
  delete process.env.TOPIC_AROUND_SEARCH_ENABLED;
  delete process.env.EMBED_QUERY_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(isTopicAroundSearchEnabled(), false);

  process.env.TOPIC_AROUND_SEARCH_ENABLED = '1';
  process.env.EMBED_QUERY_URL = 'http://embed.example';
  assert.equal(isTopicAroundSearchEnabled(), false);

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  assert.equal(isTopicAroundSearchEnabled(), true);
} finally {
  process.env = prev;
}

console.log('lib/search/topic-around-enabled.test.ts: ok');