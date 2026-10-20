# LLM faithfulness judge (v2-final)

Run on **klever** (LAN Ollama). Requires stack eval DB seeded (`npm run eval:rag:v2:seed` or full harness).

## 1) Generate answers (Ollama synthesis — not excerpt dump)

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

## Legacy note

Earlier `v2-final-answers.json` in git used intentional excerpt passthrough (`export-answers-v2.ts` `.slice(0, 1200)`); that path is removed. Regenerate before judging.
