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

### Fixture seed (deterministic)

```bash
npm run eval:rag:fixture   # refresh evals/rag/fixtures/corpus-snapshot.json (429 backoff)
npm run eval:rag:seed      # both DB variants from fixture unless RAG_EVAL_LIVE_FETCH=1
```

Seed uses **only** fixture document bodies and Stortinget export fields in the snapshot — no `questions.json` labels and no eval-only sak-meta chunks.

### Internal vs held-out metrics

Current `questions.json` is an **internal** smoke set (~80). Do **not** treat harness numbers as product targets until the held-out Stortinget corpus (169+, dev/test split) is checked in. Always **calibrate rejection on `questions-dev.json`** and report **`questions.json` as test**.

Authoritative improvement row today: **`round4-issue-ilike`** in `evals/rag/results/improvement-rounds.md`.

## Judge (LAN Ollama, optional)

Generation/judge is not run in CI/cloud by default. Answers require a reachable Ollama `/api/generate` (no excerpt passthrough).

```bash
# 1) Synthesize answers from retrieved excerpts (klever / LAN)
export ANSWER_LLM_URL=http://192.168.50.154:11434
export ANSWER_LLM_MODEL=gemma4:26b
export ANSWER_LLM_TIMEOUT_MS=600000
export ANSWER_LLM_NUM_PREDICT=768
export ANSWER_LLM_THINK=false
export RAG_EVAL_LABEL=round3-rerank-reject
npm run eval:rag:answers
# → evals/rag/results/round3-rerank-reject-answers.json

# v2 held-out sample
export RAG_EVAL_LABEL=v2-final
npm run eval:rag:answers:v2
# → evals/rag/results/v2-final-answers.json

# 2) Judge + deterministic metrics (use a different model than answers; default qwen2.5:32b)
export JUDGE_URL=http://192.168.50.154:11434
export JUDGE_MODEL=qwen2.5:32b
export JUDGE_TIMEOUT_MS=900000
export JUDGE_THINK=false
npm run eval:rag:judge -- evals/rag/results/v2-final-answers.json
# → evals/rag/results/v2-final-answers.judged.json
# → evals/rag/results/v2-final-answers-judged-summary.json
```

Improvement rounds table: `npm run eval:rag:rounds` → `evals/rag/results/improvement-rounds.md`.

## Environment

| Variable | Purpose |
|----------|---------|
| `RAG_EVAL_VARIANT` | `baseline` \| `stack` (seed) |
| `RAG_EVAL_RUN` | `all` \| `baseline` \| `stack` \| `improved` |
| `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` |
| `ANSWER_LLM_URL` / `ANSWER_LLM_MODEL` | Required for `eval:rag:answers` / `eval:rag:answers:v2` (falls back `OLLAMA_BASE_URL` for URL only) |
| `ANSWER_LLM_TIMEOUT_MS` | Answer synthesis timeout (default `600000`) |
| `ANSWER_LLM_NUM_PREDICT` | Ollama `num_predict` for answers (default `768`) |
| `ANSWER_LLM_THINK` | Ollama `think` for answer synthesis (default `false`; gemma4 uses hidden thinking tokens if true) |
| `JUDGE_URL` / `JUDGE_MODEL` | LAN judge (`judge.ts`; default `qwen2.5:32b`, must differ from answer model) |
| `ALLOW_SAME_JUDGE` | Set `1` only to allow judge model = answer model (inflates scores) |
| `RAG_EVAL_ENFORCE_TARGETS` | Set `1` to exit non-zero if gold/refusal/LLM targets miss |
| `RAG_EVAL_MAX_CHUNKS_PER_DOCUMENT` | Cap hybrid chunks per `document_id` before excerpts (default `1`) |
| `JUDGE_TIMEOUT_MS` | Per-row Ollama generate timeout (default `900000`; invalid/non-positive → default) |
| `JUDGE_THINK` | Ollama `think` for judge (default `false`) |
| `RAG_EVAL_EXCERPT_PER_CHUNK` / `RAG_EVAL_EXCERPT_TOTAL` | Excerpt caps (#177) |
| `RAG_EVAL_CHUNK_CLIP` | Hybrid clip (#179, default 1400) |
| `RAG_EVAL_MEASURE_EMBED` | Set `0` to skip central vs BYOK embed latency micro-benchmark on stack runs |
| `EMBED_QUERY_TIMEOUT_MS` | Central bge-m3 embed timeout (default 800 ms) |
| `BYOK_OLLAMA_VECTOR_TIMEOUT_MS` | BYOK nomic embed timeout (default 3000 ms); harness also reports p95 @ 800 ms vs 3 s |

## Schema note

Full Supabase migrations are not applied locally (auth roles). `evals/rag/sql/baseline.sql` plus stack migrations `20261019200000`, `20261019203000`, `20261019210000` mirror production RAG RPCs.
