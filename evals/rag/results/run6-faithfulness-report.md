# Run 6 faithfulness (PR #185)

| | run5 (reported) | run6 (this branch) |
| --- | --- | --- |
| **Judge** | Inflated (same family as answer) | **`qwen3.5:4b-q4_K_M`** (≠ `gemma4:26b`) |
| **Citation rule** | — | Deterministic unsupported numbers/quotes cap `faithfulnessCombined` |
| **Grounding** | `grounded-answer-v1` | **`grounded-answer-v2`** (no uncited numbers/quotes; weak-context refusal) |
| **R@5 (test stack)** | — | **0.975** (`evals/rag/results/v2-final-test.json`) |
| **faithfulness** | **0.833** (below 0.85 gate) | Re-export + judge on Klever (see below) |
| **faithfulnessCombined** | — | `min(LLM, citation cap)`; gate **≥ 0.85** |
| **goldFacts mean hit** | — | From `npm run eval:rag:metrics` on `run6-answers.json` |
| **incorrectRefusal rate** | — | Same metrics file |

## Klever commands

```bash
export ANSWER_LLM_URL=http://192.168.50.154:11434
export ANSWER_LLM_MODEL=gemma4:26b
export ANSWER_LLM_THINK=false
export RAG_EVAL_LABEL=run6
npm run eval:rag:answers:v2

export JUDGE_URL=http://192.168.50.154:11434
export JUDGE_MODEL=qwen3.5:4b-q4_K_M
export JUDGE_THINK=false
npm run eval:rag:judge -- evals/rag/results/run6-answers.json
npm run eval:rag:run6
```

Prior independent-judge baseline on the same stack (run4b @ klever, 24 tema rows): faithfulness **0.917** with `qwen3.5:4b-q4_K_M` before `grounded-answer-v2` and citation cap. Run6 adds stricter combined scoring; re-judge after v2 prompts is expected to clear **0.85** on `faithfulnessCombinedMean`.

## Production apply (Coolify)

Prod today: **no #185 objects**; `vector` 0.8.0 in `public`; `pg_trgm` / `unaccent` available but **not installed**; `document_chunks` ~380k rows; `stortinget_issues` without `tsv`.

**Runbook:** `supabase/migrations/RAG_PROD_APPLY_RUNBOOK.md` — transactional chain `20261022100000`–`080000`, extensions in `20261022105000` / `20261022106000`, then **six** `CREATE INDEX CONCURRENTLY` files `20261022109000`–`095000` (one statement each, **outside transaction**). `embedding_v2` backfill via n8n batches, not a single migration transaction.
