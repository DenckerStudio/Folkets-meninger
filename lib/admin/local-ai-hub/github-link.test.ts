import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGithubLinkNext } from '@/lib/admin/local-ai-hub/github-link';

describe('parseGithubLinkNext', () => {
  it('finner next-URL i Link-header', () => {
    const link =
      '<https://api.github.com/repos/o/r/issues/1/comments?page=2>; rel="next", <https://api.github.com/repos/o/r/issues/1/comments?page=5>; rel="last"';
    assert.equal(parseGithubLinkNext(link), 'https://api.github.com/repos/o/r/issues/1/comments?page=2');
  });

  it('returnerer null uten next', () => {
    assert.equal(parseGithubLinkNext('<https://api.github.com?page=1>; rel="last"'), null);
    assert.equal(parseGithubLinkNext(null), null);
  });
});