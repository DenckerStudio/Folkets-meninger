import { execSync } from 'node:child_process';
import { join } from 'node:path';

type Variant = 'baseline' | 'stack';

const STACK_MIGRATIONS = [
  '20261022100000_hybrid_search_and_embedding_v2.sql',
  '20261022101000_document_chunk_metadata_content_hash.sql',
  '20261022102000_stortinget_hearings.sql',
  '20261022103000_docling_ingest_and_embedding_v2_rpcs.sql',
];

const IMPROVEMENT_MIGRATIONS = [
  '20261022104000_rag_issue_search_sak_aggregate.sql',
  '20261022105000_rag_hybrid_prefix_trgm.sql',
  '20261022106000_rag_unaccent_short_title_tsv.sql',
  '20261022107000_rag_issue_search_ilike_boost.sql',
  '20261022108000_rag_issue_search_sak_prefix.sql',
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

function pgEnv() {
  return {
    host: process.env.RAG_EVAL_PG_HOST ?? 'localhost',
    user: process.env.RAG_EVAL_PG_USER ?? 'rag_eval',
    password: process.env.RAG_EVAL_PG_PASSWORD ?? 'rag_eval',
  };
}

function psql(database: string, file: string): void {
  const conn = pgEnv();
  const env = { ...process.env, PGPASSWORD: conn.password };
  execSync(
    `psql -h ${conn.host} -U ${conn.user} -d ${database} -v ON_ERROR_STOP=1 -q -f ${JSON.stringify(file)}`,
    { stdio: 'inherit', env },
  );
}

function resetDatabase(database: string): void {
  const conn = pgEnv();
  const env = { ...process.env, PGPASSWORD: conn.password };
  execSync(
    `psql -h ${conn.host} -U ${conn.user} -d postgres -v ON_ERROR_STOP=1 -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();"`,
    { stdio: 'inherit', env },
  );
  execSync(`dropdb -h ${conn.host} -U ${conn.user} --if-exists ${database}`, { stdio: 'inherit', env });
  execSync(`createdb -h ${conn.host} -U ${conn.user} ${database}`, { stdio: 'inherit', env });
}

function main(): void {
  const root = process.cwd();
  const { variant, database } = parseArgs();
  const improvementOnly = process.env.RAG_EVAL_IMPROVEMENT_ONLY === '1';

  if (process.env.RAG_EVAL_RESET_DB === '1') {
    resetDatabase(database);
  }

  if (!improvementOnly) {
    psql(database, join(root, 'evals', 'rag', 'scripts', 'bootstrap-pg.sql'));
    psql(database, join(root, 'evals', 'rag', 'sql', 'baseline.sql'));
    if (variant === 'stack') {
      for (const name of STACK_MIGRATIONS) {
        psql(database, join(root, 'supabase', 'migrations', name));
      }
    }
  }

  if (variant === 'stack') {
    const level = Number(process.env.RAG_EVAL_IMPROVEMENT_LEVEL ?? '0');
    for (let i = 0; i < level && i < IMPROVEMENT_MIGRATIONS.length; i += 1) {
      psql(database, join(root, 'supabase', 'migrations', IMPROVEMENT_MIGRATIONS[i]!));
    }
  }

  console.log(
    `[apply-migrations] variant=${variant} db=${database} improvementOnly=${improvementOnly} level=${process.env.RAG_EVAL_IMPROVEMENT_LEVEL ?? '0'} ok`,
  );
}

main();
