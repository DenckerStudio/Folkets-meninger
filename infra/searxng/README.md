# SearXNG on Heyklever (legacy forum prompt research)

Self-hosted meta-search used by archived n8n forum prompt workflows alongside
RSS feeds. The site-wide forum is no longer part of the product; keep this
runbook only for operating or auditing historical workflow assets under
`workflows/n8n/archive/forum/`.

## Quick start

```bash
cd infra/searxng
docker compose up -d
```

Default URL (local): `http://127.0.0.1:8080`

Production example used by the archived n8n workflow source:
`https://searxng.heyklever.app` — put behind reverse proxy with TLS.

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
