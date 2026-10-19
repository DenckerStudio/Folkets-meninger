import pg from 'pg';

export type EvalVariant = 'baseline' | 'stack';

export function databaseForVariant(variant: EvalVariant): string {
  return variant === 'baseline' ? 'rag_eval_baseline' : 'rag_eval_stack';
}

export function createPool(database?: string): pg.Pool {
  return new pg.Pool({
    host: process.env.RAG_EVAL_PG_HOST ?? 'localhost',
    user: process.env.RAG_EVAL_PG_USER ?? 'rag_eval',
    password: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval',
    database: database ?? process.env.RAG_EVAL_DATABASE ?? 'rag_eval_stack',
    max: 8,
  });
}

export async function vectorLiteral(values: number[]): Promise<string> {
  return `[${values.join(',')}]`;
}
