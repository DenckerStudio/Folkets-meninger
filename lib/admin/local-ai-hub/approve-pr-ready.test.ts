import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { markLinkedDraftPrReadyForReview } from '@/lib/admin/local-ai-hub/approve-pr-ready';
import { LOCAL_AI_BRANCH_PREFIX } from '@/lib/admin/local-ai-hub/labels';

const GH = { token: 'test-token', owner: 'DenckerStudio', repo: 'Folkets-meninger' };

function draftPull(branch: string, draft = true) {
  return {
    number: 333,
    node_id: 'PR_kwDOABC',
    html_url: `https://github.com/DenckerStudio/Folkets-meninger/pull/333`,
    state: 'open',
    merged: false,
    draft,
    mergeable: true,
    mergeable_state: 'clean',
    head: { ref: branch, sha: 'deadbeef' },
  };
}

describe('markLinkedDraftPrReadyForReview', () => {
  it('kaller GraphQL for åpen draft-PR på lokal-ai-branch', async () => {
    const branch = `${LOCAL_AI_BRANCH_PREFIX}46-fix-thing`;
    const graphqlBodies: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/pulls?') && url.includes('head=')) {
        return new Response(JSON.stringify([draftPull(branch)]), { status: 200 });
      }
      if (url === 'https://api.github.com/graphql') {
        graphqlBodies.push(init?.body?.toString() ?? '');
        return new Response(
          JSON.stringify({ data: { markPullRequestReadyForReview: { pullRequest: { isDraft: false } } } }),
          { status: 200 },
        );
      }
      if (url.includes('/issues/333/comments')) {
        return new Response(JSON.stringify({ id: 1 }), { status: 201 });
      }
      return new Response('unexpected', { status: 500 });
    };

    try {
      const result = await markLinkedDraftPrReadyForReview(GH, 46, {
        description: `Branch: ${branch}`,
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.pull.number, 333);
      }
      assert.equal(graphqlBodies.length, 1);
      assert.ok(graphqlBodies[0]?.includes('markPullRequestReadyForReview'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('kaller ikke GraphQL når PR ikke er draft', async () => {
    const branch = `${LOCAL_AI_BRANCH_PREFIX}46-fix-thing`;
    let graphqlCalls = 0;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/pulls?')) {
        return new Response(JSON.stringify([draftPull(branch, false)]), { status: 200 });
      }
      if (url === 'https://api.github.com/graphql') {
        graphqlCalls += 1;
        return new Response('{}', { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    };

    try {
      const result = await markLinkedDraftPrReadyForReview(GH, 46, {
        description: branch,
      });
      assert.equal('skipped' in result && result.skipped, true);
      assert.equal(graphqlCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('kaller ikke GraphQL for branch uten lokal-ai-prefiks', async () => {
    let graphqlCalls = 0;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      if (String(input) === 'https://api.github.com/graphql') {
        graphqlCalls += 1;
      }
      return new Response('[]', { status: 200 });
    };

    try {
      const result = await markLinkedDraftPrReadyForReview(GH, 46, {
        description: 'feature/random-branch',
      });
      assert.equal('skipped' in result && result.skipped, true);
      assert.equal(graphqlCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returnerer readyFailed når GraphQL feiler', async () => {
    const branch = `${LOCAL_AI_BRANCH_PREFIX}46-fix-thing`;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/pulls?')) {
        return new Response(JSON.stringify([draftPull(branch)]), { status: 200 });
      }
      if (url === 'https://api.github.com/graphql') {
        return new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    };

    try {
      const result = await markLinkedDraftPrReadyForReview(GH, 46, { description: branch });
      assert.equal('readyFailed' in result && result.readyFailed, true);
      if ('readyFailed' in result && result.readyFailed) {
        assert.equal(result.error, 'boom');
        assert.equal(result.pull.number, 333);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('lykkes med commentFailed når kommentar feiler etter ready', async () => {
    const branch = `${LOCAL_AI_BRANCH_PREFIX}46-fix-thing`;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/pulls?')) {
        return new Response(JSON.stringify([draftPull(branch)]), { status: 200 });
      }
      if (url === 'https://api.github.com/graphql') {
        return new Response(
          JSON.stringify({ data: { markPullRequestReadyForReview: { pullRequest: { isDraft: false } } } }),
          { status: 200 },
        );
      }
      if (url.includes('/issues/333/comments')) {
        return new Response('nope', { status: 500 });
      }
      return new Response('unexpected', { status: 500 });
    };

    try {
      const result = await markLinkedDraftPrReadyForReview(GH, 46, { description: branch });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.commentFailed, true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});