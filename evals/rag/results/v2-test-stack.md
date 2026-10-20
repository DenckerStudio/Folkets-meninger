# RAG eval v2 (test)

| Category | n | rate |
| --- | ---: | ---: |
| eksakt_sak | 19 | 84.2% |
| tema | 24 | 95.8% |
| prefiks_delord | 17 | 88.2% |
| sammensatte_ord | 16 | 100.0% |
| voteringer_parti | 20 | 95.0% |
| horinger | 20 | 100.0% |
| finnes_ikke | 25 | 0.0% |

**Sak R@5 (chunk):** 97.5% (n=40)
**Prefix (prefiks_delord):** 88.2%
**Finnes-ikke reject:** 0.0%
**p95:** 194 ms

**finnes_ikke full-text hits (not title GT):** [{"id":"v2-finnes-ikke-024","terms":["studielån"]},{"id":"v2-finnes-ikke-028","terms":["distans","arbeid"]},{"id":"v2-finnes-ikke-037","terms":["distans","arbeid"]}]
