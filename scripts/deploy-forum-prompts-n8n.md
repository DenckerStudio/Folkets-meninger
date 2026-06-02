# Deploy forum trending prompts workflow to n8n

Source: [`workflows/n8n/forum-trending-prompts.workflow.ts`](../workflows/n8n/forum-trending-prompts.workflow.ts)

Live workflow: https://n8n.heyklever.app/workflow/MloIdsnX7FozM4dv

## After editing the workflow file

1. Build ops payload (unescapes template literals for n8n Code nodes):

```bash
node scripts/build-n8n-forum-prompts-ops.mjs /tmp/n8n-forum-prompts-ops.json
node scripts/build-n8n-forum-prompts-topology-ops.mjs /tmp/n8n-forum-prompts-topology-ops.json
```

2. Push via n8n MCP `update_workflow`: topology batch first (trusted sources node, remove Has SQL?, moderation → save), then code ops (one node per call if the payload is large), or paste into n8n UI.

3. Test webhook:

```bash
curl -X POST "https://n8n.heyklever.app/webhook/folkets-forum-prompts" \
  -H "Content-Type: application/json" \
  -d '{}'
```

4. Archive misaligned active prompts in Supabase (once):

```bash
# See scripts/archive-misaligned-forum-prompts.sql
```
