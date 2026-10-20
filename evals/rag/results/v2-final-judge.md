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

Judge Ollama cascade (qwen3-vl / thinking models): `think: false` on every request; if `response` is empty, parse from `thinking`; retry once **without** `format: json`. Exits non-zero when `judgeErrorRate > JUDGE_MAX_ERROR_RATE` (default **0.5**).

Resume after a partial judge run (keeps completed rows):

```bash
npm run eval:rag:judge -- --resume evals/rag/results/v2-final-answers.json
```

Deterministic metrics only (no LLM):

```bash
npm run eval:rag:metrics -- evals/rag/results/v2-final-answers.json
```

Optional fail CI locally: `RAG_EVAL_ENFORCE_TARGETS=1` (metrics or judge command).

Outputs:

- `v2-final-answers.judged.json` — per-row LLM scores (0.25 steps) + deterministic block
- `v2-final-answers-judged-summary.json` — aggregates + **calibration warning** if >90% rows score 1/1

### Targets

| Metric | Target |
| --- | --- |
| Deterministic **goldFacts** mean hit rate (answer text) | ≥ **0.6** |
| **incorrectRefusalRate** (refusal while gold facts appear in **excerpts**) | ≤ **0.1** |
| **retrievalMissRefusalRate** (refusal when excerpts lack gold facts) | informational |
| LLM faithfulness mean | ≥ **0.85** |
| LLM quality mean | ≥ **0.7** |

Trust **deterministic goldFacts + refusal** over LLM 1.0/1.0 when the judge model matches the answer model.

### Retrieval diversity (8:15 S / same dokument)

Topic retrieval used to return many chunks from the **same `document_id`** (list metadata + votering text repeats `Dokument 8:15 S` across saker). Fix: `capChunksPerDocument` (default **1** per document, `RAG_EVAL_MAX_CHUNKS_PER_DOCUMENT`) before excerpts — hybrid fetches 8, keeps top distinct documents per sak.

### Smoke (3 rows)

```bash
RAG_EVAL_V2_ANSWER_SAMPLE=3 npm run eval:rag:answers:v2
```

## Run4b @ 91aec5f (gemma4:26b answers, klever)

Deterministic (24 tema rows with gold): goldFacts meanHitRate **0.917**, **incorrectRefusalRate 0.167** (4/24), top3DocumentShare **0.48**, uniqueSourceKeysPerTopicMean **28**.

Judge **qwen3.5:4b-q4_K_M**: errorRate 0, faithfulness **0.917**, qualityMean **0.479** (target 0.7), maxScoreFraction **0.25**.

Judge **qwen3-vl:8b**: 24/24 `judge empty response` — JSON landed in `thinking` while `format: json` left `response` empty; fixed by thinking fallback + plain retry (above).

### Incorrect refusals (015, 034, 036, 038)

Harness **topicExcerptHit** is true for all four in `v2-final-test.json` (gold issue excerpts contain the gold token). So under the refined metric these are **answer-model refusals**, not retrieval misses: excerpts included e.g. `havvind`, `tilskudd`, `barn`, `drivstoff`, but gemma4 still answered with “kildene inneholder ikke …”.

| Row | Query shape | Likely cause |
| --- | --- | --- |
| **015** | Short `havvind forurensning` | Excerpts skew to generic forurensning; model treats lack of explicit havvind sentence as “no info”. |
| **034** | Long list question on tilskudd | Needs aggregation across saker; model refuses instead of partial list. |
| **036** | `hvorfor` + barn / legemiddel | Causal “why” not stated verbatim; strict grounding → refusal. |
| **038** | `hvorfor` + drivstoffkjeder | Same as 036 for drivstoff/prissetting narrative. |

**capChunksPerDocument(1)** is unlikely the primary driver here (excerpt hit already true). **Eval-only** prompt tweak in `generate-rag-answer.ts`: allow short partial answers when excerpts mention the topic; reserve blanket refusal for truly irrelevant excerpts. Prod chat (`lib/chat/instructions.ts`) already uses a different refusal phrase; no prod change unless we align copy later.

### qualityMean ~0.48 (qwen3.5 judge)

Drivers:

1. **Post-process cap** in `applyParsedJudgeScores`: quality → **0.25** when any gold fact missing from answer text (common on tema rows with single-token gold).
2. **incorrectRefusal** rows forced to quality **0**.
3. Judge rubric caps quality at **0.25** for “kildene inneholder ikke” when excerpts had relevant info.
4. **maxScoreFraction 0.25** — almost no 1.0 quality scores; faithfulness stays high because answers stay excerpt-grounded.

Re-run answers after prompt softening + re-judge to measure incorrectRefusal and qualityMean; use **qwen3.5** or **qwen2.5:32b** until qwen3-vl judge path is verified on klever.
