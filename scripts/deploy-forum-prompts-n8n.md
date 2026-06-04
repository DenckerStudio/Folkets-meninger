# Deploy Forum Reels (v8)

Source: [`workflows/n8n/forum-research-discovery.workflow.ts`](../workflows/n8n/forum-research-discovery.workflow.ts)

Live workflow: https://n8n.heyklever.app/workflow/mjiQBSdxVv0sAuMu

See [`workflows/n8n/FORUM-PROMPTS-v8.md`](../workflows/n8n/FORUM-PROMPTS-v8.md) and `scripts/deploy-forum-v8-n8n.mjs`.

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
