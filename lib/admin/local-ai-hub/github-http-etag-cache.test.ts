import assert from 'node:assert/strict';

import {
  clearGithubHttpEtagCacheForTests,
  githubHttpCacheKey,
  githubHttpEtagCacheSizeForTests,
  GITHUB_HTTP_ETAG_CACHE_MAX_KEYS,
  readGithubHttpEtagCache,
  writeGithubHttpEtagCache,
} from '@/lib/admin/local-ai-hub/github-http-etag-cache';

clearGithubHttpEtagCacheForTests();
const key = githubHttpCacheKey('https://api.github.com/repos/o/r/pulls/1');
writeGithubHttpEtagCache(key, { etag: '"abc"', bodyText: '{"n":1}' });
assert.deepEqual(readGithubHttpEtagCache(key), { etag: '"abc"', bodyText: '{"n":1}' });

writeGithubHttpEtagCache(key, { etag: '"def"', bodyText: '{"n":2}' });
assert.equal(readGithubHttpEtagCache(key)?.etag, '"def"');

clearGithubHttpEtagCacheForTests();
for (let i = 0; i < GITHUB_HTTP_ETAG_CACHE_MAX_KEYS + 1; i += 1) {
  writeGithubHttpEtagCache(`GET:https://example.com/${i}`, {
    etag: `"e${i}"`,
    bodyText: `${i}`,
  });
}
assert.equal(githubHttpEtagCacheSizeForTests(), GITHUB_HTTP_ETAG_CACHE_MAX_KEYS);
assert.equal(readGithubHttpEtagCache('GET:https://example.com/0'), null);
assert.ok(readGithubHttpEtagCache(`GET:https://example.com/${GITHUB_HTTP_ETAG_CACHE_MAX_KEYS}`));

clearGithubHttpEtagCacheForTests();
console.log('lib/admin/local-ai-hub/github-http-etag-cache.test.ts: ok');
