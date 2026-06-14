# SearXNG on Heyklever (open-source web search for forum prompts)

Self-hosted meta-search used by the n8n «forum trending prompts» workflow alongside RSS feeds.

## Quick start

```bash
cd infra/searxng
docker compose up -d
```

Default URL (local): `http://127.0.0.1:8080`

Production example: `https://search.heyklever.app` — put behind reverse proxy with TLS.

## n8n configuration

In workflow **Folkets Stemme – Forum trending prompts**, set the **Backfill settings** Set node:

| Key | Example |
|-----|---------|
| `searxngBaseUrl` | `https://search.heyklever.app` |
| `batchLimit` | `5` (max prompts per run) |

n8n blocks `$env` in expressions — use Set nodes, not environment variables in node fields.

## JSON API

```bash
curl 'https://search.heyklever.app/search?q=site:vg.no+nyheter&format=json&language=nb-NO'
```

If SearXNG is unavailable, the n8n workflow continues with RSS-only headlines.

## settings.yml notes

- Enable `search.formats: [html, json]`
- Set `default_lang: nb-NO`
- Limit engines if rate-limited

See [SearXNG documentation](https://docs.searxng.org/) for full configuration.
