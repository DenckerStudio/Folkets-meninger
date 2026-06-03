# Deploy forum trending prompts workflow to n8n

Source: [`workflows/n8n/forum-trending-prompts.workflow.ts`](../workflows/n8n/forum-trending-prompts.workflow.ts)

Live workflow: https://n8n.heyklever.app/workflow/MloIdsnX7FozM4dv

## After editing the workflow file

1. Build ops payload (unescapes template literals for n8n Code nodes):

```bash
node scripts/build-n8n-forum-prompts-v5-topology-ops.mjs /tmp/n8n-forum-prompts-v5-topology-ops.json
node scripts/build-n8n-forum-prompts-ops.mjs /tmp/n8n-forum-prompts-ops.json
node scripts/build-n8n-forum-prompts-tools-ops.mjs /tmp/n8n-forum-prompts-tools-ops.json
node scripts/build-n8n-forum-prompts-agent-fix-ops.mjs /tmp/n8n-forum-prompts-agent-fix-ops.json
```

2. Push via n8n MCP `update_workflow` (atomic batches):
   - v5 topology (`Fetch article bodies` between Collect → Build agent input)
   - code ops (prefer `setNodeParameter` with path `/jsCode` for large Code nodes; split Moderation into its own call)
   - tools ops (`check_duplicate`, `read_article_clusters` → agent `ai_tool`)

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
