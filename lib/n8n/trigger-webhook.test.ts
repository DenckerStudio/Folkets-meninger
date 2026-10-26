import assert from 'node:assert/strict';
import { postN8nWebhook, triggerN8nWebhook } from './trigger-webhook';

async function run(): Promise<void> {
  assert.equal(
    triggerN8nWebhook({ kind: 'ai-summary', url: undefined, body: { id: '1' } }),
    false,
    'missing url is not queued',
  );

  assert.equal(
    triggerN8nWebhook({ kind: 'ai-summary', url: '   ', body: {} }),
    false,
    'blank url is not queued',
  );

  const originalFetch = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  let failCount = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (failCount > 0) {
      failCount -= 1;
      throw new Error('network down');
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    failCount = 1;
    const recovered = await postN8nWebhook(
      'https://n8n.example/webhook',
      { id: '200329' },
      'ai-summary',
      200,
      2,
    );
    assert.equal(recovered, true, 'retries after first failure');
    assert.equal(calls.length, 2, 'two attempts');
    assert.equal(calls[0]?.init?.method, 'POST');
    const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
    assert.equal(headers?.['Content-Type'], 'application/json');
    assert.equal(headers?.['X-FM-Webhook-Token'], undefined, 'no token header by default');

    calls.length = 0;
    const secretToken = 'test-ai-summary-token-do-not-log';
    const withToken = await postN8nWebhook(
      'https://n8n.example/webhook',
      { id: '1' },
      'ai-summary',
      200,
      1,
      secretToken,
    );
    assert.equal(withToken, true);
    const tokenHeaders = calls[0]?.init?.headers as Record<string, string> | undefined;
    assert.equal(tokenHeaders?.['X-FM-Webhook-Token'], secretToken);

    calls.length = 0;
    failCount = 2;
    const exhausted = await postN8nWebhook(
      'https://n8n.example/webhook',
      {},
      'system-poll-draft',
      200,
      2,
    );
    const logLines: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      logLines.push(args.map((a) => String(a)).join(' '));
    };
    try {
      assert.equal(exhausted, false, 'returns false after retries');
      assert.equal(calls.length, 2, 'exhausted both attempts');

      calls.length = 0;
      failCount = 0;
      globalThis.fetch = (async () => new Response('', { status: 500 })) as typeof fetch;
      await postN8nWebhook(
        'https://n8n.example/webhook',
        {},
        'ai-summary',
        200,
        1,
        secretToken,
      );
      const combinedLogs = logLines.join('\n');
      assert.doesNotMatch(combinedLogs, /test-ai-summary-token-do-not-log/);
    } finally {
      console.warn = originalWarn;
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('n8n trigger webhook tests OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
