import { join } from 'node:path';

export const V2_DIR = join(process.cwd(), 'evals/rag/datasets/v2');

export function v2CorpusConfigPath(): string {
  return join(V2_DIR, 'corpus-v2.json');
}

export function v2SnapshotPath(): string {
  return join(V2_DIR, 'corpus-v2-snapshot.json');
}

export function v2QuestionsPath(split: 'dev' | 'test'): string {
  return join(V2_DIR, split === 'dev' ? 'questions-v2-dev.json' : 'questions-v2-test.json');
}

export function v2FixtureBodiesPath(): string {
  return join(process.cwd(), 'evals/rag/fixtures/corpus-v2-bodies.json');
}
