# Deploy forum Reels v12 workflows to n8n

**Live (v12):**

| Workflow | ID | Kilde |
|----------|-----|--------|
| Regjeringen RSS ingest | `6yy1ESY2Zy7cWgtF` | [`forum-regjeringen-rss-ingest.workflow.ts`](../workflows/n8n/forum-regjeringen-rss-ingest.workflow.ts) |
| JA/NEI prompt generator | `vOP2zPflfT0yBvDQ` | [`forum-prompt-generator.workflow.ts`](../workflows/n8n/forum-prompt-generator.workflow.ts) |

**Arkiv (v10 — ikke redeploy):** scout `j6NZpV4IHP0AHFVj`, journalist `sb31mc2dmhIvdbRg`, editor `YY6u4GmeiZVk5R2e`

Dok: [`workflows/n8n/FORUM-PROMPTS-v12.md`](../workflows/n8n/FORUM-PROMPTS-v12.md)

## Etter endring i repo

1. Bundle:

```bash
node scripts/bundle-forum-regjeringen-rss-workflow.mjs .tmp/forum-regjeringen-rss-bundled.ts
node scripts/bundle-forum-prompt-generator-workflow.mjs .tmp/forum-prompt-generator-bundled.ts
```

2. Valider via n8n MCP: `validate_workflow` på bundled `.ts` (inline shared constants).

3. Deploy:
   - **Prompt generator:** `node scripts/deploy-forum-v12-prompt-generator.mjs` (REST patch live `vOP2zPflfT0yBvDQ`)
   - **RSS:** MCP `create_workflow_from_code` (ny instans) eller `update_workflow` / REST patch på `6yy1ESY2Zy7cWgtF`
   - **Alt:** `npm run deploy:forum-v12`

4. Publiser: MCP `publish_workflow` eller REST `POST /workflows/{id}/activate`

## Webhooks

```bash
curl -X POST "https://n8n.heyklever.app/webhook/folkets-forum-regjeringen-rss" \
  -H "Content-Type: application/json" -d '{}'

curl -X POST "https://n8n.heyklever.app/webhook/folkets-forum-prompt-generator" \
  -H "Content-Type: application/json" -d '{}'
```

Manuell replay med cluster-id:

```bash
curl -X POST "https://n8n.heyklever.app/webhook/folkets-forum-prompt-generator" \
  -H "Content-Type: application/json" \
  -d '{"clusterId":"<uuid>"}'
```

## Env (app)

```bash
N8N_FORUM_SYNTHESIS_WEBHOOK_URL=https://n8n.heyklever.app/webhook/folkets-forum-prompt-generator
```

## Credentials (n8n)

| Credential | Noder |
|------------|--------|
| Fokets Meninger | Postgres |
| Ollama account | Prompt generator agent + JSON parser |
