# SearXNG on Heyklever (open-source web search)

Used by the Stemme+ AI-chat `searchUpdatedSources` tool (`lib/chat/searxng.ts`)
and historically by archived n8n forum-prompt workflows.

Self-hosted meta-search used by the n8n «forum trending prompts» workflow alongside RSS feeds.

## Quick start

```bash
cd infra/searxng
docker compose up -d
```

Default URL (local): `http://127.0.0.1:8080`

Production (fm-web on Coolify): set `SEARXNG_BASE_URL` to the LAN instance, e.g. `http://192.168.50.154:8002`.

## n8n configuration

In workflow **Folkets Meninger – Forum trending prompts**, set the **Backfill settings** Set node:

| Key | Example |
|-----|---------|
| `searxngBaseUrl` | e.g. `http://192.168.50.154:8002` (archived forum workflows only) |
| `batchLimit` | `25` in the Set node; workflow code clamps generated prompts to max 12 per run |

n8n blocks `$env` in expressions — use Set nodes, not environment variables in node fields.

## JSON API

```bash
curl 'http://192.168.50.154:8002/search?q=site:vg.no+nyheter&format=json&language=nb-NO'
```

If SearXNG is unavailable, the n8n workflow continues with RSS-only headlines.

## settings.yml notes

- Enable `search.formats: [html, json]`
- Set `default_lang: nb-NO`
- Limit engines if rate-limited

See [SearXNG documentation](https://docs.searxng.org/) for full configuration.
