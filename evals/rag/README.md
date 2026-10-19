# Offline RAG evaluation (Folkets Meninger)

Isolated Postgres + pgvector on the VM. Corpus seeded only from public `data.stortinget.no` APIs.
Embeddings via local Ollama (`bge-m3` stack, `nomic-embed-text` baseline). No production DB, no external LLM APIs.

## Quick start

```bash
# 1) Databases (bootstrap + RAG schema)
npm run eval:rag:db

# 2) Seed corpus (both variants; network + Ollama required)
npm run eval:rag:seed

# 3) Metrics: baseline vs stack vs improved
npm run eval:rag
```

Results land in `evals/rag/results/summary.md` and JSON per run.

## Judge (LAN Ollama, optional)

Generation/judge is not run in CI/cloud by default. After saving answers JSON:

```bash
JUDGE_URL=http://192.168.50.154:11434 JUDGE_MODEL=gemma4:26b \
  npm run eval:rag:judge -- evals/rag/results/stack-answers.json
```

## Environment

| Variable | Purpose |
|----------|---------|
| `RAG_EVAL_VARIANT` | `baseline` \| `stack` (seed) |
| `RAG_EVAL_RUN` | `all` \| `baseline` \| `stack` \| `improved` |
| `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` |
| `JUDGE_URL` / `JUDGE_MODEL` | LAN judge (`judge.ts`) |
| `RAG_EVAL_EXCERPT_PER_CHUNK` / `RAG_EVAL_EXCERPT_TOTAL` | Excerpt caps (#177) |
| `RAG_EVAL_CHUNK_CLIP` | Hybrid clip (#179, default 1400) |
| `RAG_EVAL_MEASURE_EMBED` | Set `0` to skip central vs BYOK embed latency micro-benchmark on stack runs |
| `EMBED_QUERY_TIMEOUT_MS` | Central bge-m3 embed timeout (default 800 ms) |
| `BYOK_OLLAMA_VECTOR_TIMEOUT_MS` | BYOK nomic embed timeout (default 3000 ms); harness also reports p95 @ 800 ms vs 3 s |

## Schema note

Full Supabase migrations are not applied locally (auth roles). `evals/rag/sql/baseline.sql` plus stack migrations `20261019200000`, `20261019203000`, `20261019210000` mirror production RAG RPCs.
