import { execSync } from 'node:child_process';
import { join } from 'node:path';

type Variant = 'baseline' | 'stack';

const STACK_MIGRATIONS = [
  '20261019200000_hybrid_search_and_embedding_v2.sql',
  '20261019203000_document_chunk_metadata_content_hash.sql',
  '20261019210000_stortinget_hearings.sql',
  '20261019220000_docling_ingest_and_embedding_v2_rpcs.sql',
];

function parseArgs(): { variant: Variant; database: string } {
  const variant = (process.env.RAG_EVAL_VARIANT ?? process.argv[2] ?? 'stack') as Variant;
  if (variant !== 'baseline' && variant !== 'stack') {
    throw new Error(`Unknown variant ${variant}`);
  }
  const database =
    process.env.RAG_EVAL_DATABASE ??
    (variant === 'baseline' ? 'rag_eval_baseline' : 'rag_eval_stack');
  return { variant, database };
}

function psql(database: string, file: string): void {
  const conn = {
    host: process.env.RAG_EVAL_PG_HOST ?? 'localhost',
    user: process.env.RAG_EVAL_PG_USER ?? 'rag_eval',
    password: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval',
  };
  const env = { ...process.env, PGPASSWORD: conn.password };
  execSync(
    `psql -h ${conn.host} -U ${conn.user} -d ${database} -v ON_ERROR_STOP=1 -q -f ${JSON.stringify(file)}`,
    { stdio: 'inherit', env },
  );
}

function main(): void {
  const root = process.cwd();
  const { variant, database } = parseArgs();
  psql(database, join(root, 'evals', 'rag', 'scripts', 'bootstrap-pg.sql'));
  psql(database, join(root, 'evals', 'rag', 'sql', 'baseline.sql'));
  if (variant === 'stack') {
    for (const name of STACK_MIGRATIONS) {
      psql(database, join(root, 'supabase', 'migrations', name));
    }
  }
  console.log(`[apply-migrations] variant=${variant} db=${database} ok`);
}

main();
