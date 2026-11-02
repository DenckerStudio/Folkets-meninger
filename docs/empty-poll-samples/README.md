# Tom avstemning / avviklet avstemning — skjermbilder

Referansebilder for tom avstemning-liste og **avviklet system-reel** på avstemning-detalj.

## Avviklet avstemning (ekte skjermbilder)

**Dato:** 2026-11-02

**Kilde:** offentlig produksjon, uten innlogging. Playwright (headless Chromium), `document.fonts.ready` før capture, tema satt via `localStorage`-nøkkelen `folkets:app:preferences` (`theme`: `light` | `dark`), samme som appens temabytter.

**URL-mønster:**

`https://www.folkets-meninger.no/dashboard/avstemninger/{poll-id}`

Eksempel-ID brukt ved capture: `293646fb-76a1-46ca-8208-a971bfe6d2e4` (verifisert også mot `a17795f4-7381-4ee9-ad50-a9148cddd60f`).

| Fil | Viewport | Tema |
|-----|----------|------|
| `retired-detail-360-light.png` | 360×800 | lys |
| `retired-detail-360-dark.png` | 360×800 | mørk |
| `retired-detail-1280-light.png` | 1280×800 | lys |
| `retired-detail-1280-dark.png` | 1280×800 | mørk |

Clip: innhold over footer (eller én viewport) slik at hele varselet og lenken «Utforsk saker» er med.

## Tom avstemning-liste

Eksisterende filer `avstemninger-*` er fortsatt mock/fallback fra lokal capture-script (`scripts/capture-empty-poll-samples.mjs`) når listen er tom.

## `/del` og `/embed`

Retired-visninger for deling og embed er **ikke** inkludert her. I produksjon returnerer `/del/{id}` og `/embed/{id}` 404 for ikke-administratorer mens `SHARE_POLLS_ENABLED` er av. Når flagget slås på, kan tilsvarende ekte captures legges inn med samme navngivning som tidligere mockups (`del-*`, `embed-*`).
