# LLM faithfulness judge (v2-final)

**Status:** Judge host `http://192.168.50.154:11434` is **not reachable** from the Cloud Agent VM (private LAN). Run locally on your network.

## Generate answers (v2 test sample, excerpt-grounded stub)

```bash
RAG_EVAL_LABEL=v2-final npm run eval:rag:answers:v2
```

Equivalent to the v1 script name with v2 dataset:

```bash
# v1 export uses evals/rag/questions.json — for v2 use answers:v2
RAG_EVAL_LABEL=v2-final npm run eval:rag:answers:v2
```

Output: `evals/rag/results/v2-final-answers.json` (24 non–issue_search rows in this run).

## Run judge

```bash
JUDGE_URL=http://192.168.50.154:11434 JUDGE_MODEL=gemma4:26b JUDGE_TIMEOUT_MS=900000 \
  npm run eval:rag:judge -- evals/rag/results/v2-final-answers.json
```

Produces `v2-final-answers.judged.json` and `v2-final-answers-judged-summary.json` alongside.
