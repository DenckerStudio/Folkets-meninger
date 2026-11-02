# Stortinget-poll admin (skjermbilder)

PNG-ene i denne mappen er tatt mot **lokal `next start`** med **fiktive fixture-data** (saks-id `999001`, tittel og ingress er oppfinnelser — ikke ekte Stortinget-saker).

Generering:

```bash
node scripts/capture-stortinget-poll-admin-samples.mjs
```

Skriptet oppretter midlertidige ruter under `app/dev/stortinget-poll-admin-capture/`, bygger appen, tar bilder og sletter rutene igjen.
