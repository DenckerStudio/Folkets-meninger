# LLM faithfulness judge (v2-final) — robust metrics

## Klever / Coolify Expert (rag-eval-pg seeded)

Use a **different judge model** than the answer model (default guard). Recommended on klever:

- **Answers:** `gemma4:26b` (`think: false`)
- **Judge:** `qwen2.5:32b` (or another non-gemma model installed on Ollama)

### 1) Generate answers

```bash
cd /path/to/Folkets-meninger
export ANSWER_LLM_URL=http://192.168.50.154:11434
export ANSWER_LLM_MODEL=gemma4:26b
export ANSWER_LLM_TIMEOUT_MS=600000
export ANSWER_LLM_NUM_PREDICT=768
export ANSWER_LLM_THINK=false
export RAG_EVAL_LABEL=v2-final

npm run eval:rag:answers:v2
```

Writes `evals/rag/results/v2-final-answers.json` (includes `retrievalSourceKeys`, `retrievalDocumentIds` per row).

### 2) Judge + deterministic metrics

```bash
export JUDGE_URL=http://192.168.50.154:11434
export JUDGE_MODEL=qwen2.5:32b
export JUDGE_TIMEOUT_MS=900000
export JUDGE_THINK=false
# Do NOT set ALLOW_SAME_JUDGE unless debugging self-judge inflation

npm run eval:rag:judge -- evals/rag/results/v2-final-answers.json
```

Optional fail CI locally: `RAG_EVAL_ENFORCE_TARGETS=1` (same command).

Outputs:

- `v2-final-answers.judged.json` — per-row LLM scores (0.25 steps) + deterministic block
- `v2-final-answers-judged-summary.json` — aggregates + **calibration warning** if >90% rows score 1/1

### Targets

| Metric | Target |
| --- | --- |
| Deterministic **goldFacts** mean hit rate (answer text) | ≥ **0.6** |
| **incorrectRefusalRate** (refusal while gold facts exist) | ≤ **0.1** |
| LLM faithfulness mean | ≥ **0.85** |
| LLM quality mean | ≥ **0.7** |

Trust **deterministic goldFacts + refusal** over LLM 1.0/1.0 when the judge model matches the answer model.

### Retrieval diversity (8:15 S / same dokument)

Topic retrieval used to return many chunks from the **same `document_id`** (list metadata + votering text repeats `Dokument 8:15 S` across saker). Fix: `capChunksPerDocument` (default **1** per document, `RAG_EVAL_MAX_CHUNKS_PER_DOCUMENT`) before excerpts — hybrid fetches 8, keeps top distinct documents per sak.

### Smoke (3 rows)

```bash
RAG_EVAL_V2_ANSWER_SAMPLE=3 npm run eval:rag:answers:v2
```
