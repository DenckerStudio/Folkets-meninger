# Run 6 faithfulness (PR #185)

**Git ref for n8n / Klever eval:** `005ee8b` (branch `cursor/rag-improve-drastisk-5738`). Re-run `git rev-parse HEAD` on the PR branch before scheduling if newer commits landed.

| | run5 (reported) | run6 (this branch) |
| --- | --- | --- |
| **Judge** | Inflated (same family as answer) | **`qwen3.5:4b-q4_K_M`** (≠ `gemma4:26b`) |
| **Citation rule** | — | Deterministic unsupported numbers/quotes cap `faithfulnessCombined` |
| **Grounding** | `grounded-answer-v1` | **`grounded-answer-v2`** (no uncited numbers/quotes; weak-context refusal) |
| **R@5 (test stack)** | — | **0.975** (`evals/rag/results/v2-final-test.json`) |
| **faithfulness** | **0.833** (below 0.85 gate) | Re-export + judge on Klever (commands below) |
| **faithfulnessCombined** | — | `min(LLM, citation cap)`; gate **≥ 0.85** |
| **goldFacts mean hit** | — | From `npm run eval:rag:metrics` on `run6-answers.json` |
| **incorrectRefusal rate** | — | Same metrics file |

## Klever / n8n (exact)

Check out **`cursor/rag-improve-drastisk-5738`** at **`ea570a1`** (or current PR HEAD). Apply eval DB stack if needed:

```bash
export RAG_EVAL_PG_HOST=localhost
export RAG_EVAL_PG_USER=rag_eval
export RAG_EVAL_PG_PASSWORD=rag_eval
npm run eval:rag:db
RAG_EVAL_DATASET=v2 RAG_EVAL_VARIANT=stack npm run eval:rag:v2:seed
```

Answer export + judge (Ollama on Klever `192.168.50.154:11434`):

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

Artifacts: `evals/rag/results/run6-answers.json`, `run6-answers-judged-summary.json`, `run6-faithfulness-report.json` (written by `npm run eval:rag:run6`).

Prior independent-judge baseline on the same stack (run4b @ klever, 24 tema rows): faithfulness **0.917** with `qwen3.5:4b-q4_K_M` before `grounded-answer-v2` and citation cap. Run6 adds stricter combined scoring; re-judge after v2 prompts is expected to clear **0.85** on `faithfulnessCombinedMean`.

## Production apply (Coolify)

Prod today: **no #185 objects**; `vector` 0.8.0 in `public`; `pg_trgm` / `unaccent` available but **not installed**; `document_chunks` ~380k rows; `stortinget_issues` without `tsv`.

**Runbook:** `supabase/migrations/RAG_PROD_APPLY_RUNBOOK.md` — pause n8n → transactional `20261022100000`–`080000` + **`22109600`** (service_role RPC lockdown) → six `CREATE INDEX CONCURRENTLY` files `20261022109000`–`095000` → verify (incl. `indisvalid`) → merge (fm-web auto-deploys on `main`). Measured: `22100000` ~74 s ACCESS EXCLUSIVE (+523 MB table, ~1.2 GB WAL); `22109300` trgm GIN ~98 s; **15 min** maintenance window.
