import assert from 'node:assert/strict';
import { formatChunkExcerptForDisplay } from './chunk-excerpt';

const sample = `## Komiteens merknader

<!-- image -->

| Post | Beløp |
| --- | ---: |
| Drift | 45 |
| Tom | |

**Viktig** og [lenke](https://example.com).

Vanlig avsnitt.
`;

const out = formatChunkExcerptForDisplay(sample);
assert.match(out, /Komiteens merknader/);
assert.doesNotMatch(out, /<!--/);
assert.doesNotMatch(out, /^\|/m);
assert.match(out, /Drift · 45/);
assert.match(out, /Tom ·/);
assert.match(out, /Viktig og lenke/);
assert.doesNotMatch(out, /\*\*/);
assert.match(out, /Vanlig avsnitt/);

console.log('chunk-excerpt.test.ts: ok');
