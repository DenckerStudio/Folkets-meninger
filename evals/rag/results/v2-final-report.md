# v2-final (full corpus)

**Git SHA:** `c41024dc8d7b7aa249dab0685b612989c5d356c1`
**Distractor chunks in index:** yes (list metadata per sak)
**Corpus:** 2465 issues, 3114 chunks, 28 hearings.

**Aggregate sak R@5 (test):** 97.5% ✓

| Category | dev n | dev % | test n | test % |
| --- | ---: | ---: | ---: | ---: |
| eksakt_sak | 9 | 100.0% | 19 | 84.2% |
| tema | 10 | 100.0% | 24 | 95.8% |
| prefiks_delord | 8 | 87.5% | 17 | 88.2% |
| sammensatte_ord | 9 | 88.9% | 16 | 100.0% |
| voteringer_parti | 9 | 88.9% | 20 | 95.0% |
| horinger | 8 | 100.0% | 20 | 100.0% |
| finnes_ikke | 11 | 100.0% | 25 | 100.0% |

| Metric | dev | test |
| --- | --- | --- |
| **Aggregate sak R@5** (dev n=17, test n=40) | **94.1%** | **97.5%** (target ≥85%) |
| Prefix (prefiks_delord) | 87.5% | 88.2% |
| Finnes-ikke reject | 100.0% | 100.0% |
| p95 latency (ms) | 534 | 336 |
| Skipped (hearing) | 0 | 0 |

## Notes

- **Aggregate sak R@5 (test)** meets the ≥85% gate (97.5%). No search/ingest change required for that target.
- **eksakt_sak (test) 84.2%** — three misses under full distractor index (dev eksakt_sak is 100% after sak-prefix search):
  - `v2-eksakt-sak-003` `grunnlov norsk hovudspråk` → gold `99386` (many Grunnlovsforslag outrank on FTS).
  - `v2-eksakt-sak-007` `nasjonale prøver skole` → gold `200174`.
  - `v2-eksakt-sak-008` `folkeforslag grunnlov` → gold `100036`.
- **LLM judge:** see `v2-final-judge.md` (LAN Ollama unreachable from CI VM).