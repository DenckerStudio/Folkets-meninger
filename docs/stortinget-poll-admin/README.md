# Stortinget-poll admin (skjermbilder)

Alle PNG-er er tatt mot **lokal `next start`** med **fiktive fixture-data** (saks-id `999001`, påført avstemning `fixture-poll-999001`). Ingenting viser ekte Stortinget-saker eller prod-data.

Generering:

```bash
node scripts/capture-stortinget-poll-admin-samples.mjs
```

Skriptet oppretter midlertidige ruter under `app/dev/stortinget-poll-admin-capture/`, bygger appen, tar bilder og sletter rutene igjen.

## Filindeks

| Fil | Innhold |
|-----|---------|
| `sak-dialog-light-360.png` | Sak-side (fiksjon) med publiseringsdialog åpen, lys, smal |
| `sak-dialog-light-1280.png` | Samme, lys, desktop |
| `sak-dialog-dark-360.png` | Samme, mørk, smal |
| `sak-dialog-dark-1280.png` | Samme, mørk, desktop |
| `sak-blokkert-light-360.png` | Sak med eldre systemavstemning: forklaring uten handling (lys, smal) |
| `sak-blokkert-light-1280.png` | Samme blokkert-tilstand, lys, desktop |
| `sak-blokkert-dark-1280.png` | Samme blokkert-tilstand, mørk, desktop |
| `dialog-bekreft-light-360.png` | Bekreftelsessteg «Publisere nå?» før første publisering |
| `dialog-feil-light-360.png` | Valideringsfeil (sluttidspunkt i fortiden) |
| `dialog-last-light-360.png` | Publiseringsdialog med lasteindikator (fixture) |
| `sak-rediger-light-360.png` | Sak der avstemning finnes: «Se avstemningen» + «Rediger avstemning» |
| `dialog-rediger-light-1280.png` | Rediger-dialog for eksisterende avstemning |
| `avstemning-liste-apen-light-1280.png` | `/avstemninger`-kort med lang tittel og fremtidig sluttid |
| `avstemning-detalj-apen-light-1280.png` | Avstemningsside med stemmeknapper (åpen) |
| `avstemning-liste-avsluttet-light-1280.png` | Liste med «Avstemningen er avsluttet» |
| `avstemning-detalj-avsluttet-light-1280.png` | Detalj uten stemmeknapper, avsluttet |
