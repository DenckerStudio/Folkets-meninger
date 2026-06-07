'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

type ClusterArticle = {
  id: string;
  title: string;
  url: string;
  outlet: string | null;
  published_at: string | null;
  is_primary: boolean;
};

type ResearchCluster = {
  id: string;
  title: string;
  discovery_rationale: string | null;
  topic_tags: string[];
  source_count: number;
  status: string;
  created_at: string;
  forum_research_articles?: ClusterArticle[];
};

type SourceRow = {
  title: string;
  url: string;
  outlet: string;
};

type DraftPrompt = {
  id: string;
  question: string;
  topic_tags: string[];
  sensitivity: string;
  source_headlines: { title?: string; outlet?: string; url?: string }[];
  created_at: string;
};

function defaultExpiresIso(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date(defaultExpiresIso());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

function sourcesFromPrompt(
  headlines: { title?: string; outlet?: string; url?: string }[] | undefined,
): SourceRow[] {
  if (!Array.isArray(headlines)) return [];
  return headlines.map((h) => ({
    title: String(h.title ?? ''),
    url: String(h.url ?? ''),
    outlet: String(h.outlet ?? 'Regjeringen'),
  }));
}

function emptySourceRow(): SourceRow {
  return { title: '', url: '', outlet: 'Regjeringen' };
}

function formatApiError(status: number, message: string): string {
  if (status === 400 || status === 409) return message;
  return message || `Feil (${status})`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
}

function clusterStatusLabel(status: string): string {
  if (status === 'pending') return 'Venter på AI';
  return status;
}

function SourceEditor({
  sources,
  onChange,
}: {
  sources: SourceRow[];
  onChange: (next: SourceRow[]) => void;
}) {
  const rows = sources.length ? sources : [emptySourceRow()];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Kilder (tittel, URL, avis)</p>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] items-start border border-gray-100 rounded-lg p-3"
        >
          <input
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Tittel"
            value={row.title}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...next[index], title: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="https://…"
            value={row.url}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...next[index], url: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Kilde"
            value={row.outlet}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...next[index], outlet: e.target.value };
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-red-600 px-1"
            onClick={() => {
              const next = rows.filter((_, i) => i !== index);
              onChange(next.length ? next : [emptySourceRow()]);
            }}
          >
            Fjern
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-indigo-700 hover:underline"
        onClick={() => onChange([...rows, emptySourceRow()])}
      >
        + Kilde
      </button>
    </div>
  );
}

type AdminForumPipelinePanelProps = {
  onGoToActive: () => void;
  onGoToCreate: () => void;
};

export function AdminForumPipelinePanel({ onGoToActive, onGoToCreate }: AdminForumPipelinePanelProps) {
  const [queueClusters, setQueueClusters] = useState<ResearchCluster[]>([]);
  const [drafts, setDrafts] = useState<DraftPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [publishModalId, setPublishModalId] = useState<string | null>(null);
  const [publishExpiresAt, setPublishExpiresAt] = useState(() => toDatetimeLocalValue(null));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    question: '',
    topic_tags: '',
    sensitivity: 'low',
    sources: [] as SourceRow[],
  });

  const loadPipeline = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [queueRes, draftsRes] = await Promise.all([
        fetch('/api/admin/forum-clusters?status=pending'),
        fetch('/api/admin/forum-prompts?status=draft'),
      ]);
      const [queueData, draftsData] = await Promise.all([queueRes.json(), draftsRes.json()]);

      if (!queueRes.ok) {
        setError(formatApiError(queueRes.status, queueData.error || 'Kunne ikke laste kø'));
        setQueueClusters([]);
      } else {
        setQueueClusters(queueData.clusters || []);
      }

      if (draftsRes.ok) {
        setDrafts(draftsData.prompts || []);
      }
    } catch {
      if (!opts?.silent) {
        setError('Kunne ikke laste pipeline');
        setQueueClusters([]);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);

  useEffect(() => {
    if (queueClusters.length === 0) return;
    const interval = window.setInterval(() => {
      void loadPipeline({ silent: true });
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [queueClusters.length, loadPipeline]);

  const rejectCluster = async (id: string) => {
    setActing(id);
    setError('');
    try {
      const res = await fetch('/api/admin/forum-clusters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], action: 'reject' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(res.status, data.error || 'Feil ved avvisning'));
        return;
      }
      setQueueClusters((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setActing(null);
    }
  };

  const patchPrompt = async (id: string, body: Record<string, unknown>) => {
    setActing(id);
    setError('');
    try {
      const res = await fetch('/api/admin/forum-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(res.status, data.error || 'Feil ved oppdatering'));
        return false;
      }
      return true;
    } finally {
      setActing(null);
    }
  };

  const openPublishModal = (id: string) => {
    setPublishModalId(id);
    setPublishExpiresAt(toDatetimeLocalValue(null));
  };

  const confirmPublish = async () => {
    if (!publishModalId) return;
    const ok = await patchPrompt(publishModalId, {
      status: 'active',
      expires_at: fromDatetimeLocalValue(publishExpiresAt),
    });
    if (ok) {
      setPublishModalId(null);
      setDrafts((prev) => prev.filter((p) => p.id !== publishModalId));
    }
  };

  const archiveDraft = async (id: string) => {
    const ok = await patchPrompt(id, { status: 'archived' });
    if (ok) setDrafts((prev) => prev.filter((p) => p.id !== id));
  };

  const startEdit = (prompt: DraftPrompt) => {
    setEditingId(prompt.id);
    setEditForm({
      question: prompt.question,
      topic_tags: (prompt.topic_tags || []).join(', '),
      sensitivity: prompt.sensitivity,
      sources: sourcesFromPrompt(prompt.source_headlines),
    });
  };

  const saveEdit = async (id: string) => {
    const source_headlines = editForm.sources.filter((s) => s.title.trim() || s.url.trim());
    const ok = await patchPrompt(id, {
      question: editForm.question,
      topic_tags: editForm.topic_tags.split(',').map((t) => t.trim()).filter(Boolean),
      sensitivity: editForm.sensitivity,
      source_headlines,
    });
    if (ok) {
      setEditingId(null);
      void loadPipeline({ silent: true });
    }
  };

  const pendingCount = queueClusters.length;

  return (
    <div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900">Automatisk pipeline (v12)</h2>
        <p className="text-sm text-gray-600 mt-1">
          Regjeringen RSS henter saker hver 30. min. AI genererer JA/NEI-spørsmål hver 15. min. Du
          godkjenner utkast og publiserer til Forum Reels.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500">I kø</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{pendingCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Utkast</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{drafts.length}</dd>
          </div>
        </dl>
      </div>

      {error ? (
        <div
          className="mb-6 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {publishModalId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 id="publish-modal-title" className="text-lg font-bold text-gray-900 mb-2">
              Publiser reel
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Velg når den aktive reelen skal utløpe (standard er 7 dager fra nå).
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Utløper
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={publishExpiresAt}
                onChange={(e) => setPublishExpiresAt(e.target.value)}
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPublishModalId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={acting === publishModalId}
                onClick={confirmPublish}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Publiser
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Laster pipeline…
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Automatisk kø</h2>
              <p className="text-sm text-gray-500">
                Saker fra Regjeringen RSS — behandles uten manuell godkjenning
              </p>
            </div>

            {queueClusters.length === 0 ? (
              <p className="text-gray-500 text-sm py-6 rounded-xl border border-dashed border-gray-200 text-center">
                Ingen saker i kø. Kjør RSS-webhooken eller vent på neste cron (*/30).
              </p>
            ) : (
              <div className="space-y-4">
                {queueClusters.map((cluster) => {
                  const article = (cluster.forum_research_articles || [])[0];
                  return (
                    <article
                      key={cluster.id}
                      className="rounded-xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                          {clusterStatusLabel(cluster.status)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatWhen(cluster.created_at)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{cluster.title}</h3>
                      {cluster.discovery_rationale ? (
                        <p className="text-sm text-gray-600 mt-2">{cluster.discovery_rationale}</p>
                      ) : null}
                      {article ? (
                        <p className="mt-3 text-xs text-gray-500">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                          >
                            {article.outlet || 'Regjeringen'}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                      ) : null}
                      {cluster.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            type="button"
                            disabled={!!acting}
                            onClick={() => rejectCluster(cluster.id)}
                            className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                          >
                            Avvis sak
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-indigo-700 mt-3 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Utkast dukker opp nedenfor når AI er ferdig (innen ~15 min).
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Utkast til godkjenning</h2>
              <p className="text-sm text-gray-500">Rediger, publiser eller avvis AI-genererte reels</p>
            </div>

            {drafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
                <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">Ingen utkast venter.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Du kan også{' '}
                  <button
                    type="button"
                    onClick={onGoToCreate}
                    className="text-indigo-700 font-medium hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    opprette en reel manuelt
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {drafts.map((prompt) => (
                  <article key={prompt.id} className="rounded-xl border border-gray-200 bg-white p-5">
                    {editingId === prompt.id ? (
                      <div className="space-y-3">
                        <textarea
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          rows={3}
                          value={editForm.question}
                          onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                        />
                        <input
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="Stikkord (kommaseparert)"
                          value={editForm.topic_tags}
                          onChange={(e) => setEditForm((f) => ({ ...f, topic_tags: e.target.value }))}
                        />
                        <label className="block text-sm font-medium text-gray-700">
                          Sensitivitet
                          <select
                            className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            value={editForm.sensitivity}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, sensitivity: e.target.value }))
                            }
                          >
                            <option value="low">Lav</option>
                            <option value="high">Høy</option>
                          </select>
                        </label>
                        <SourceEditor
                          sources={editForm.sources}
                          onChange={(sources) => setEditForm((f) => ({ ...f, sources }))}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(prompt.id)}
                            disabled={acting === prompt.id}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            Lagre
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            Utkast · {prompt.sensitivity === 'high' ? 'Høy sensitivitet' : 'Lav sensitivitet'}
                          </span>
                          {(prompt.topic_tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3">{prompt.question}</h3>
                        {Array.isArray(prompt.source_headlines) && prompt.source_headlines.length > 0 ? (
                          <ul className="text-xs text-gray-500 mb-4 space-y-1">
                            {prompt.source_headlines.slice(0, 4).map((h, i) => (
                              <li key={i}>
                                {h.url ? (
                                  <a
                                    href={h.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:underline"
                                  >
                                    {h.title} ({h.outlet})
                                  </a>
                                ) : (
                                  <span>
                                    {h.title} ({h.outlet})
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={acting === prompt.id}
                            onClick={() => openPublishModal(prompt.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            Publiser
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(prompt)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="w-4 h-4" />
                            Rediger
                          </button>
                          <button
                            type="button"
                            disabled={acting === prompt.id}
                            onClick={() => archiveDraft(prompt.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Avvis
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <p className="mt-8 text-sm text-gray-500 text-center">
        Publiserte reels finner du under{' '}
        <button
          type="button"
          onClick={onGoToActive}
          className="text-indigo-700 font-medium hover:underline"
        >
          Aktive
        </button>
        . Køen oppdateres automatisk mens AI jobber.
      </p>
    </div>
  );
}
