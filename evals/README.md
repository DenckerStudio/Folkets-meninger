# Evals – Stemme+-chat, sak-sammendrag og høringer

Golden set og eval-runner for plan P1 (`ai-forbedring-rag-plan`, avsnitt 5). Målet er å ha tall før vi endrer prompt, retrieval eller modell, og å kjøre samme sett etter hver endring.

## Golden set (`evals/golden/`)

| Fil | Antall | Innhold |
|---|---|---|
| `chat.jsonl` | 40 | 15 om én bestemt sak, 10 tematiske på tvers av saker, 5 om høringer og frister, 5 om votering og folkets stemmer, 5 feller (stemmeråd, sak som ikke finnes, beløp som ikke står i kildene) |
| `saker.jsonl` | 20 | Proposisjoner, Dokument 8, budsjett, meldinger og Riksrevisjonen, både ferdigbehandlet og til behandling. 4–7 nøkkelfakta og en kort referansetekst per sak |
| `horinger.jsonl` | 10 | Høringer med frist, komité og tema |

Felter i `chat.jsonl`: `kategori`, `spørsmål`, `åpen_sak` (sak-id når spørsmålet stilles fra en åpen sak, tilsvarer `x-sak-id`), `sak_ids`, `forventede_chunk_ids`, `nøkkelfakta[]`, `skal_avslå` og `avslagstype` (`stemmeråd` | `ukjent_sak` | `ukjent_beløp`).

**Kilde og status.** Sak-id-er, komiteer, forslagstillere, vedtak og tall er hentet fra data.stortinget.no (sak- og høringseksporten) 17.10.2026, og kan etterprøves der. Ingen fakta er hentet fra modellsvar. Alle rader har `godkjent: false` til Mathias har gått gjennom dem (åpent spørsmål 8 i planen).

- `forventede_chunk_ids` er tomme. De må fylles fra produksjonsdatabasen (`document_chunks`, format `document_id:chunk_index`). Inntil da måles retrieval på saksnivå (`sak_ids`).
- Høringer endrer seg fortløpende. Frister og status gjelder uttrekket 17.10.2026.

## Kjøring

```bash
npm run eval -- --suite chat|summary|hearing|all --variant <navn> [--generate]
```

Resultatet skrives til `evals/results/<dato>-<variant>-<suite>.json` og `.md`. Runneren leser `.env.local` / `.env` som Next.js.

| Suite | Krever | Måler |
|---|---|---|
| `chat` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (kun lesing av offentlige tabeller) | Kjører dagens retrieval i `lib/chat/rag.ts` (`searchIssuesForChat`, `retrieveSakContext`, `retrieveTopicContext`). Sak-recall@8, MRR, chunk-recall@8 (når chunk-id-er finnes) og dekning av nøkkelfakta i konteksten |
| `chat --generate` | I tillegg `EVAL_LLM_PROVIDER`, `EVAL_LLM_MODEL`, `EVAL_LLM_API_KEY` (og `EVAL_LLM_BASE_URL` for `ollama` / `openai_compatible`) | Kjører hele chat-løpet (systemprompt, verktøy, maks 8 steg) med `generateText`. Dekning av nøkkelfakta i svaret, sitatdekning `[n]`, tall som ikke finnes i verktøyresultatene, danske former, riktig avslag på feller, latens p50/p95 |
| `summary` | Samme Supabase-variabler | Leser `issue_ai_summaries` for de 20 sakene. Dekning av nøkkelfakta, tall som ikke finnes i kildene (sak og chunks), danske former, lengdekravet `hva` ≥ 40 / `hvem` ≥ 20 |
| `hearing` | Nett mot data.stortinget.no | Det chatten får fra `findHearingsForSak` (`collectHearingsForSak`): finnes høringen, stemmer frist (dato i Europe/Oslo), komité og tema. Høringssammendrag finnes ikke ennå (P9) og rapporteres som 0 |

## Scoring (`scripts/evals/scoring.ts`)

Alt er deterministisk og enhetstestet (`scripts/evals/scoring.test.ts`, del av `npm run test:unit`).

- **Nøkkelfakta:** normalisert tekst (små bokstaver, tallformat `136 549` → `136549`, `4,69` → `4.69`). Et faktum kan ha alternativer skilt med `|`. Treff når hele frasen finnes, eller når minst 80 % av ordene finnes (ord sammenlignes på de fem første bokstavene, tall må være like).
- **Recall@8 og MRR:** mot `sak_ids` (og `forventede_chunk_ids` når de er fylt ut).
- **Hallusinerte tall:** tall i svaret som ikke finnes i kildene eller i spørsmålet. Sitatmarkører `[n]` og nummererte lister telles ikke. Samme regel som den planlagte validatoren for sammendrag (plan 4.2).
- **Sitatdekning:** andel faktalinjer (≥ 40 tegn, utenfor «Kilder») med `[n]`.
- **Danske former:** regex-listen i `DANISH_FORM_PATTERNS`.
- **Avslag:** stemmeråd-feller krever et nøytralt avslag og ingen stemmeanbefaling. Feller om ukjent sak eller beløp krever at svaret sier at det ikke fant noe, og for beløp at det ikke dikter opp tall.
- **Faithfulness og sitatpresisjon** krever en LLM-dommer. Det er ikke valgt om dommeren skal kjøre lokalt eller med betalt nøkkel (åpent spørsmål 7), så de rapporteres som «ikke målt».

## Baseline 17.10.2026 (main @ 1940a82)

Se `evals/results/`. Kort status:

- `2026-10-17-main-hearing`: kjørt mot data.stortinget.no. Datalaget finner alle 10 høringene med riktig frist, komité og tema (1,0). Høringssammendrag: 0 av 10 (finnes ikke).
- `2026-10-17-main-testdb-chat` og `-summary`: **kun røyktest** mot test-Supabase (`qetckokgtzbpunbzslfp`), som bare har 7 saker, 5 chunks og 1 sammendrag. Tallene viser at runneren virker, men sier ingenting om kvaliteten i produksjon.
- **Ikke kjørt:** chat-retrieval og sammendrag mot produksjon (self-hosted Supabase), fordi URL og anon-nøkkel for den ikke finnes i miljøet der baseline ble kjørt. `--generate` er heller ikke kjørt fordi ingen LLM-nøkkel var tilgjengelig. Kjør `npm run eval -- --suite all --variant main --generate` med produksjonsvariablene og en BYOK-nøkkel for å få den egentlige baselinen.
