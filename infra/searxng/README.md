# SearXNG on Heyklever (legacy forum prompt dependency)

Self-hosted meta-search formerly used by the archived n8n forum prompt
workflows alongside RSS feeds. The site-wide forum and forum Reels are removed
from the product; current system-generated Reels live under Avstemninger and use
Stortinget sak RAG, not SearXNG.

Keep this note for historical workflow debugging only. Active app/n8n setup
should not require `SEARXNG_*` environment variables or live SearXNG access.

## Quick start

```bash
cd infra/searxng
docker compose up -d
```

Default URL (local): `http://127.0.0.1:8080`

Historical production example used by archived workflow source:
`https://searxng.heyklever.app` — put behind reverse proxy with TLS if the
legacy workflow must be replayed in isolation.

## n8n configuration

In archived workflow **Folkets Stemme – Forum trending prompts**, set the
**Backfill settings** Set node:

| Key | Example |
|-----|---------|
| `searxngBaseUrl` | `https://searxng.heyklever.app` |
| `batchLimit` | `25` in the Set node; workflow code clamps generated prompts to max 12 per run |

n8n blocks `$env` in expressions — use Set nodes, not environment variables in node fields.

## JSON API

```bash
curl 'https://searxng.heyklever.app/search?q=site:vg.no+nyheter&format=json&language=nb-NO'
```

If SearXNG is unavailable, the archived n8n workflow continues with RSS-only
headlines.

## settings.yml notes

- Enable `search.formats: [html, json]`
- Set `default_lang: nb-NO`
- Limit engines if rate-limited

See [SearXNG documentation](https://docs.searxng.org/) for full configuration.
