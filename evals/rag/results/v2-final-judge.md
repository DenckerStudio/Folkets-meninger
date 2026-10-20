# LLM faithfulness judge (v2-final)

## Root cause (klever judge quality 0.075 — pre-fix)

The judged run used **stub answers**, not failed LLM synthesis:

| Evidence | Meaning |
| --- | --- |
| Almost every answer starts with **`Basert på utdrag:`** and repeats excerpt text | Intentional template in `export-answers-v2.ts` (removed in `0f91547`) |
| **009 / 023** cut off mid-sentence | **`.slice(0, 1200)`** on concatenated excerpts — not `num_predict` |
| **010 / 011 / 015** repeat irrelevant hits | No LLM step to say “cannot answer from sources” — stub always dumps retrieval |
| No `generationError` rows | No swallowed timeout; **no `/api/generate` call** in the old export path |

**Prod:** Stemme+ chat uses `streamText` + BYOK in `app/api/chat/route.ts` — **not** this export stub. Prod is unaffected.

**Fix:** `evals/rag/lib/generate-rag-answer.ts` calls Ollama `/api/generate` with a synthesis prompt; excerpt passthrough is rejected; export exits non-zero on `generationError`. Regression: `export-answers.regression.test.ts`, `generate-rag-answer.test.ts`.

Regenerate answers after pulling the fix, then re-judge.

---

Run on **klever** (LAN Ollama). Requires stack eval DB seeded (`npm run eval:rag:v2:seed` or full harness).

## 1) Generate answers (Ollama synthesis)

```bash
export ANSWER_LLM_URL=http://192.168.50.154:11434
export ANSWER_LLM_MODEL=gemma4:26b
export ANSWER_LLM_TIMEOUT_MS=600000
export ANSWER_LLM_NUM_PREDICT=768
export RAG_EVAL_LABEL=v2-final

npm run eval:rag:answers:v2
```

Output: `evals/rag/results/v2-final-answers.json` (exits non-zero if any row has `generationError`).

Optional smoke (3 rows): `RAG_EVAL_V2_ANSWER_SAMPLE=3` with the same env.

## 2) Faithfulness judge

```bash
export JUDGE_URL=http://192.168.50.154:11434
export JUDGE_MODEL=gemma4:26b
export JUDGE_TIMEOUT_MS=900000

npm run eval:rag:judge -- evals/rag/results/v2-final-answers.json
```

Produces `v2-final-answers.judged.json` and `v2-final-answers-judged-summary.json`.

**Targets (after rerun):** quality ≥ 0.7, faithfulness ≥ 0.85.
