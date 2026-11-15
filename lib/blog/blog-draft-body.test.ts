import assert from 'node:assert/strict';
import {
  blogDraftBodyEmbedsSourceList,
  sanitizeBlogDraftBodyMarkdown,
} from '@/lib/blog/blog-draft-body';
import { buildBriefBodyMarkdownFromOutput } from '@/lib/admin/research/topic-blog-draft-body';

const raw = `## Dagens regler

Tekst med henvisning [^2] og [1].

## Kilder

1. **NRK** (nrk.no)

[^2]: NRK — nrk.no. https://www.nrk.no/1`;

const cleaned = sanitizeBlogDraftBodyMarkdown(raw);
assert.match(cleaned, /\[2\]/);
assert.doesNotMatch(cleaned, /\[\^/);
assert.doesNotMatch(cleaned, /^## Kilder/m);
assert.equal(blogDraftBodyEmbedsSourceList(cleaned), false);

const briefBody = buildBriefBodyMarkdownFromOutput(
  {
    topic_title: 'Tema',
    current_rules: { items: ['Regel'], note: 'ok' },
    party_proposals: { items: [], note: 'ingen funnet' },
    media_coverage: { items: [], note: 'ingen funnet' },
    polls: { items: [], note: 'ingen funnet' },
    sources: {
      items: [
        {
          id: '1',
          title: 'NRK',
          url: 'https://www.nrk.no/1',
          publisher: 'nrk.no',
          grade: 'B',
        },
      ],
      note: 'ok',
    },
  },
  false,
);

assert.doesNotMatch(briefBody, /^## Kilder/m);

console.log('lib/blog/blog-draft-body.test.ts ok');