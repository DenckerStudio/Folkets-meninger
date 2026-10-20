# v2 baseline vs stack (same corpus)

**Git SHA:** `c41024dc8d7b7aa249dab0685b612989c5d356c1`
**Baseline:** `evals/rag/sql/baseline.sql` (main search path, no RAG migrations)
**Stack:** v2-final full run (level-5 migrations, distractor chunks enabled)
**Corpus:** 2465 issues, 3114 stack chunks (see `v2-final-report.md`)

| Category | base dev | stack dev | base test | stack test |
| --- | ---: | ---: | ---: | ---: |
| eksakt_sak | 0.0% | 100.0% | 0.0% | 84.2% |
| tema | 0.0% | 100.0% | 0.0% | 95.8% |
| prefiks_delord | 87.5% | 87.5% | 88.2% | 88.2% |
| sammensatte_ord | 11.1% | 88.9% | 50.0% | 100.0% |
| voteringer_parti | 44.4% | 88.9% | 15.0% | 95.0% |
| horinger | 0.0% | 100.0% | 0.0% | 100.0% |
| finnes_ikke | 45.5% | 100.0% | 80.0% | 100.0% |

| Metric | base dev | stack dev | base test | stack test |
| --- | ---: | ---: | ---: | ---: |
| Aggregate sak R@5 | 52.9% | 94.1% | 50.0% | 97.5% |
| p95 ms | 552 | 534 | 349 | 336 |