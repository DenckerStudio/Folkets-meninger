import assert from 'node:assert/strict';
import { platformSummaryModelsSentence } from '@/lib/trust/ai-transparency';

const sentence = platformSummaryModelsSentence();
assert.ok(sentence.length > 40, 'setning skal være fullstendig');
assert.doesNotMatch(sentence, /\bqwen|gemma|openai|anthropic\b/i);
assert.doesNotMatch(sentence, /\s\.\s*$/);
assert.match(sentence, /Norge/);

console.log('lib/trust/ai-transparency-landing.test.ts: ok');