import assert from 'node:assert/strict';
import {
  rerankCandidates,
  rerankerEnabled,
  resetRerankerMissingLogForTests,
  resolveRerankerBaseUrl,
} from './rerank';

const prevRerankEnabled = process.env.RAG_RERANKER_ENABLED;
const prevRerankerUrl = process.env.RERANKER_URL;
const prevOllama = process.env.OLLAMA_BASE_URL;

function restoreEnv(): void {
  if (prevRerankEnabled === undefined) delete process.env.RAG_RERANKER_ENABLED;
  else process.env.RAG_RERANKER_ENABLED = prevRerankEnabled;
  if (prevRerankerUrl === undefined) delete process.env.RERANKER_URL;
  else process.env.RERANKER_URL = prevRerankerUrl;
  if (prevOllama === undefined) delete process.env.OLLAMA_BASE_URL;
  else process.env.OLLAMA_BASE_URL = prevOllama;
}

assert.equal(resolveRerankerBaseUrl(), null);

delete process.env.RERANKER_URL;
process.env.OLLAMA_BASE_URL = 'http://192.168.50.154:11434/';
assert.equal(resolveRerankerBaseUrl(), 'http://192.168.50.154:11434');

process.env.RERANKER_URL = 'http://rerank.local:11434';
assert.equal(resolveRerankerBaseUrl(), 'http://rerank.local:11434');

resetRerankerMissingLogForTests();
process.env.RAG_RERANKER_ENABLED = '1';
delete process.env.RERANKER_URL;
delete process.env.OLLAMA_BASE_URL;
delete process.env.RERANKER_HTTP_URL;

const warnings: string[] = [];
const prevWarn = console.warn;
console.warn = (msg: string) => {
  warnings.push(msg);
};

void (async () => {
  const fused = await rerankCandidates('q', [{ id: '1', content: 'doc', fusedScore: 0.42 }]);
  assert.equal(fused.usedReranker, false);
  assert.deepEqual(fused.scores, [0.42]);
  assert.equal(warnings.filter((w) => w.includes('[rerank]')).length, 1);
  assert.match(warnings[0], /RERANKER_URL mangler/);

  warnings.length = 0;
  await rerankCandidates('q', [{ id: '2', content: 'doc2', fusedScore: 0.1 }]);
  assert.equal(warnings.length, 0);

  console.warn = prevWarn;
  restoreEnv();

  assert.equal(rerankerEnabled(), false);

  console.log('lib/chat/rerank.test.ts: ok');
})();
