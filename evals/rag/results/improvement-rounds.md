| Round | R@5 | MRR | Prefix | Finnes-ikke reject | Issue search | Retrieval p95 | Central embed p95 | BYOK p95 @800ms | BYOK p95 @3s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-main | 46.7% | 0.394 | 42.9% | 0.0% | 27.6% | 54 | 0 | 0 | 0 |
| stack-previous | 23.3% | 0.211 | 28.6% | 88.2% | 31.0% | 190 | 249 | 306 | 73 |
| round1-sak-search | 23.3% | 0.211 | 28.6% | 88.2% | 31.0% | 200 | 252 | 199 | 121 |
| round2-prefix-trgm | 23.3% | 0.233 | 28.6% | 88.2% | 31.0% | 194 | 278 | 224 | 120 |
| round3-rerank-reject | 23.3% | 0.233 | 28.6% | 100.0% | 31.0% | 212 | 281 | 212 | 59 |
