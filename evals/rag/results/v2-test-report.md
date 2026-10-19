# v2 held-out test report (round4 stack, realistic corpus)

Corpus: 2465 issues indexed (2320 distractors + 145 core), 800 chunks, 28 hearings seeded, 0 hearings excluded (not faked).
Rejection threshold (dev-calibrated): 0.22

Targets met: yes

## Dev vs test

| Category | dev n | dev % | test n | test % |
| --- | ---: | ---: | ---: | ---: |
| eksakt_sak | 9 | 77.8% | 19 | 84.2% |
| tema | 10 | 100.0% | 24 | 95.8% |
| prefiks_delord | 8 | 87.5% | 17 | 88.2% |
| sammensatte_ord | 9 | 88.9% | 16 | 100.0% |
| voteringer_parti | 9 | 88.9% | 20 | 95.0% |
| horinger | 8 | 100.0% | 20 | 100.0% |
| finnes_ikke | 11 | 100.0% | 25 | 100.0% |

| | dev | test |
| --- | --- | --- |
| Sak R@5 | 94.1% | 100.0% |
| Prefix | 87.5% | 88.2% |
| Finnes-ikke reject | 100.0% | 100.0% |
| p95 latency (ms) | 386 | 272 |
| Skipped (hearing) | 0 | 0 |

Caveats: `tema` labels may be weak; `finnes_ikke` GT is title-only (see finnesIkkeFullTextHits in JSON).