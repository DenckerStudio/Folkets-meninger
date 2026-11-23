import assert from 'node:assert/strict';

import { githubConditionalJsonGet } from '@/lib/admin/local-ai-hub/github-conditional-json-get';
import { clearGithubHttpEtagCacheForTests } from '@/lib/admin/local-ai-hub/github-http-etag-cache';

type MockResponse = {
  status: number;
  headers: Map<string, string>;
  body: string;
};

function createFetchMock(responses: MockResponse[]) {
  let calls = 0;
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const step = responses[calls];
    calls += 1;
    if (!step) {
      throw new Error('unexpected fetch call');
    }

    if (
      step.status === 304 &&
      init?.headers &&
      typeof init.headers === 'object' &&
      'If-None-Match' in (init.headers as Record<string, string>)
    ) {
      return {
        ok: false,
        status: 304,
        headers: {
          get: (name: string) => step.headers.get(name.toLowerCase()) ?? null,
        },
        text: async () => step.body,
      };
    }

    const ok = step.status >= 200 && step.status < 300;
    return {
      ok,
      status: step.status,
      headers: {
        get: (name: string) => step.headers.get(name.toLowerCase()) ?? null,
      },
      text: async () => step.body,
    };
  }) as typeof fetch;

  return { fetchImpl, getCallCount: () => calls };
}

async function runGithubConditionalJsonGetTests(): Promise<void> {
  clearGithubHttpEtagCacheForTests();

  const url = 'https://api.github.com/repos/o/r/pulls/7';
  const { fetchImpl, getCallCount } = createFetchMock([
    {
      status: 200,
      headers: new Map([
        ['etag', '"pr-7"'],
        ['link', '<https://api.github.com/next?page=2>; rel="next"'],
      ]),
      body: JSON.stringify({ number: 7 }),
    },
    { status: 304, headers: new Map(), body: '' },
  ]);
  const first = await githubConditionalJsonGet<{ number: number }>({
    url,
    headers: { Accept: 'application/json' },
    fetchImpl,
  });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.data.number, 7);
    assert.equal(first.servedFromConditionalCache, false);
    assert.match(first.linkHeader ?? '', /rel="next"/);
  }

  const second = await githubConditionalJsonGet<{ number: number }>({
    url,
    headers: { Accept: 'application/json' },
    fetchImpl,
  });
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.data.number, 7);
    assert.equal(second.servedFromConditionalCache, true);
  }
  assert.equal(getCallCount(), 2);

  clearGithubHttpEtagCacheForTests();
}

runGithubConditionalJsonGetTests()
  .then(() => {
    console.log('lib/admin/local-ai-hub/github-conditional-json-get.test.ts: ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
