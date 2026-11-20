export function ResearchWebhookNotice({
  configured,
  missingEnvKeys,
}: {
  configured: boolean;
  missingEnvKeys: string[];
}) {
  if (configured) return null;
  const names =
    missingEnvKeys.length > 0
      ? missingEnvKeys
      : ['N8N_RESEARCH_WEBHOOK_BASE', 'N8N_RESEARCH_WEBHOOK_SECRET', 'N8N_RESEARCH_WEBHOOK_TOKEN'];
  return (
    <div
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
      role="status"
    >
      <p className="font-medium">Research-knapper krever n8n-oppsett</p>
      <p className="mt-1 text-muted-foreground">
        Utdyp og blogg starter webhook-arbeidsflyter. Sett{' '}
        {names.map((key, index) => (
          <span key={key}>
            {index > 0 ? (index === names.length - 1 ? ' og ' : ', ') : null}
            <code className="text-xs">{key}</code>
          </span>
        ))}{' '}
        på fm-web, og aktiver research-utdyp og blogg-fra-research i n8n (ikke dryRun).
      </p>
    </div>
  );
}
