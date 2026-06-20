'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Pencil, Plus, X } from 'lucide-react';
import { DEFAULT_REEL_VOTE_OPTIONS } from '@/lib/forum/prompt-vote-options';
import { routes } from '@/lib/routes';

type PromptStatus = 'draft' | 'active' | 'archived';

type SourceRow = {
  title: string;
  url: string;
  outlet: string;
};

type AdminPrompt = {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  topic_tags: string[];
  sensitivity: string;
  status: PromptStatus;
  source_headlines: { title?: string; outlet?: string; url?: string }[];
  created_at: string;
  expires_at?: string | null;
  submitted_by?: string | null;
  submission_tier?: 'trusted' | 'curator' | null;
};

type TrustedSource = {
  id: string;
  domain: string;
  outlet_label: string;
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
};

type Tab = 'drafts' | 'active' | 'archived' | 'create' | 'sources';

const TABS: { id: Tab; label: string; status?: PromptStatus }[] = [
  { id: 'drafts', label: 'Godkjenn utkast', status: 'draft' },
  { id: 'active', label: 'Aktive', status: 'active' },
  { id: 'archived', label: 'Arkiv', status: 'archived' },
  { id: 'create', label: 'Opprett manuelt' },
  { id: 'sources', label: 'Godkjente kilder' },
];

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
    outlet: String(h.outlet ?? 'Nyhet'),
  }));
}

function emptySourceRow(): SourceRow {
  return { title: '', url: '', outlet: 'Nyhet' };
}

function formatApiError(status: number, message: string): string {
  if (status === 409) return message;
  if (status === 400) return message;
  return message || `Feil (${status})`;
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
            placeholder="Avis"
            value={row.outlet}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...next[index], outlet: e.target.value };
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-red-600 px-2 py-2"
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
        + Legg til kilde
      </button>
    </div>
  );
}

export default function AdminForumPromptsClient() {
  const [tab, setTab] = useState<Tab>('drafts');
  const [prompts, setPrompts] = useState<AdminPrompt[]>([]);
  const [sources, setSources] = useState<TrustedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<PromptStatus>('draft');
  const [publishModalId, setPublishModalId] = useState<string | null>(null);
  const [publishExpiresAt, setPublishExpiresAt] = useState(() => toDatetimeLocalValue(null));
  const [editForm, setEditForm] = useState({
    question: '',
    topic_tags: '',
    sensitivity: 'low',
    expires_at: '',
    sources: [] as SourceRow[],
  });
  const [createForm, setCreateForm] = useState({
    question: '',
    topic_tags: '',
    sensitivity: 'low',
    status: 'draft' as PromptStatus,
    sources: [] as SourceRow[],
  });
  const [newSource, setNewSource] = useState({ domain: '', outlet_label: '' });

  const loadPrompts = useCallback(async (status: PromptStatus) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/forum-prompts?status=${status}`);
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(res.status, data.error || 'Ingen tilgang'));
        setPrompts([]);
        return;
      }
      setPrompts(data.prompts || []);
    } catch {
      setError('Kunne ikke laste');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/forum-sources');
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(res.status, data.error || 'Ingen tilgang'));
        setSources([]);
        return;
      }
      setSources(data.sources || []);
    } catch {
      setError('Kunne ikke laste kilder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'sources') {
      loadSources();
      return;
    }
    if (tab === 'create') {
      setLoading(false);
      return;
    }
    const cfg = TABS.find((t) => t.id === tab);
    if (cfg?.status) loadPrompts(cfg.status);
  }, [tab, loadPrompts, loadSources]);

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
      setPrompts((prev) => prev.filter((p) => p.id !== publishModalId));
    }
  };

  const archivePrompt = async (id: string) => {
    const ok = await patchPrompt(id, { status: 'archived' });
    if (ok) setPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  const startEdit = (prompt: AdminPrompt) => {
    setEditingId(prompt.id);
    setEditingStatus(prompt.status);
    setEditForm({
      question: prompt.question,
      topic_tags: (prompt.topic_tags || []).join(', '),
      sensitivity: prompt.sensitivity,
      expires_at: prompt.expires_at
        ? toDatetimeLocalValue(prompt.expires_at)
        : toDatetimeLocalValue(null),
      sources: sourcesFromPrompt(prompt.source_headlines),
    });
  };

  const saveEdit = async (id: string) => {
    const source_headlines = editForm.sources.filter((s) => s.title.trim() || s.url.trim());
    const body: Record<string, unknown> = {
      question: editForm.question,
      topic_tags: editForm.topic_tags.split(',').map((t) => t.trim()).filter(Boolean),
      sensitivity: editForm.sensitivity,
      source_headlines,
    };
    if (editingStatus === 'active') {
      body.expires_at = fromDatetimeLocalValue(editForm.expires_at);
    }
    const ok = await patchPrompt(id, body);
    if (ok) {
      setEditingId(null);
      const cfg = TABS.find((t) => t.id === tab);
      if (cfg?.status) loadPrompts(cfg.status);
    }
  };

  const submitCreate = async () => {
    setActing('create');
    setError('');
    const source_headlines = createForm.sources.filter((s) => s.title.trim() || s.url.trim());
    try {
      const res = await fetch('/api/admin/forum-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: createForm.question,
          status: createForm.status,
          sensitivity: createForm.sensitivity,
          topic_tags: createForm.topic_tags.split(',').map((t) => t.trim()).filter(Boolean),
          source_headlines,
          options: [...DEFAULT_REEL_VOTE_OPTIONS],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(res.status, data.error || 'Kunne ikke opprette'));
        return;
      }
      setCreateForm({
        question: '',
        topic_tags: '',
        sensitivity: 'low',
        status: 'draft',
        sources: [],
      });
      setTab('drafts');
    } finally {
      setActing(null);
    }
  };

  const addSource = async () => {
    setActing('new-source');
    try {
      const res = await fetch('/api/admin/forum-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSource, status: 'approved' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(res.status, data.error || 'Kunne ikke legge til kilde'));
        return;
      }
      setNewSource({ domain: '', outlet_label: '' });
      loadSources();
    } finally {
      setActing(null);
    }
  };

  const updateSourceStatus = async (id: string, status: TrustedSource['status']) => {
    setActing(id);
    try {
      const res = await fetch('/api/admin/forum-sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(formatApiError(res.status, data.error || 'Feil'));
        return;
      }
      loadSources();
    } finally {
      setActing(null);
    }
  };

  const draftCount = tab === 'drafts' ? prompts.length : undefined;

  return (
    <div>
      <Link href={routes.forum} className="text-sm text-indigo-600 hover:text-indigo-500 mb-4 inline-block">
        ← Tilbake til forum
      </Link>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Forum Reels (admin)</h1>
        <Link
          href={routes.adminForumReports}
          className="text-sm font-semibold text-indigo-700 hover:underline"
        >
          Forum-rapporter →
        </Link>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Godkjenn utkast, rediger aktive reels og administrer godkjente nyhetskilder.
      </p>

      <nav className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.label}
            {t.id === 'drafts' && draftCount != null && draftCount > 0 ? ` (${draftCount})` : null}
          </button>
        ))}
      </nav>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100"
          role="alert"
        >
          {error}
        </div>
      )}

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

      {loading && tab !== 'create' ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Laster…
        </div>
      ) : null}

      {!loading && tab === 'create' ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 max-w-2xl">
          <label className="block text-sm font-medium text-gray-700">
            Spørsmål
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={3}
              value={createForm.question}
              onChange={(e) => setCreateForm((f) => ({ ...f, question: e.target.value }))}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Stikkord (kommaseparert)
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={createForm.topic_tags}
              onChange={(e) => setCreateForm((f) => ({ ...f, topic_tags: e.target.value }))}
            />
          </label>
          <div className="flex gap-4">
            <label className="text-sm font-medium text-gray-700">
              Sensitivitet
              <select
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={createForm.sensitivity}
                onChange={(e) => setCreateForm((f) => ({ ...f, sensitivity: e.target.value }))}
              >
                <option value="low">Lav</option>
                <option value="high">Høy (utkast)</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Status ved opprettelse
              <select
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, status: e.target.value as PromptStatus }))
                }
              >
                <option value="draft">Utkast</option>
                <option value="active">Aktiv</option>
              </select>
            </label>
          </div>
          <SourceEditor
            sources={createForm.sources}
            onChange={(sources) => setCreateForm((f) => ({ ...f, sources }))}
          />
          <button
            type="button"
            disabled={acting === 'create'}
            onClick={submitCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Opprett reel
          </button>
        </div>
      ) : null}

      {!loading && tab === 'sources' ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-wrap gap-3 items-end">
            <label className="text-sm font-medium text-gray-700">
              Domene
              <input
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm w-48"
                placeholder="example.no"
                value={newSource.domain}
                onChange={(e) => setNewSource((s) => ({ ...s, domain: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Visningsnavn
              <input
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm w-48"
                value={newSource.outlet_label}
                onChange={(e) => setNewSource((s) => ({ ...s, outlet_label: e.target.value }))}
              />
            </label>
            <button
              type="button"
              disabled={acting === 'new-source'}
              onClick={addSource}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Legg til
            </button>
          </div>
          <ul className="space-y-2">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <span className="font-semibold text-gray-900">{s.outlet_label}</span>
                  <span className="text-gray-500 text-sm ml-2">{s.domain}</span>
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      s.status === 'approved'
                        ? 'bg-green-50 text-green-800'
                        : s.status === 'pending'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {s.status === 'approved'
                      ? 'Godkjent'
                      : s.status === 'pending'
                        ? 'Venter'
                        : 'Avvist'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {s.status !== 'approved' ? (
                    <button
                      type="button"
                      disabled={acting === s.id}
                      onClick={() => updateSourceStatus(s.id, 'approved')}
                      className="text-xs font-semibold text-indigo-700 hover:underline"
                    >
                      Godkjenn
                    </button>
                  ) : null}
                  {s.status !== 'rejected' ? (
                    <button
                      type="button"
                      disabled={acting === s.id}
                      onClick={() => updateSourceStatus(s.id, 'rejected')}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Avvis
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && ['drafts', 'active', 'archived'].includes(tab) ? (
        prompts.length === 0 && !error ? (
          <p className="text-gray-500 py-8">Ingen reels i denne fanen.</p>
        ) : (
          <div className="space-y-4">
            {prompts.map((prompt) => (
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
                    {editingStatus === 'active' ? (
                      <label className="block text-sm font-medium text-gray-700">
                        Utløper
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          value={editForm.expires_at}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, expires_at: e.target.value }))
                          }
                        />
                      </label>
                    ) : null}
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
                        {prompt.status === 'draft'
                          ? 'Utkast'
                          : prompt.status === 'active'
                            ? 'Aktiv'
                            : 'Arkivert'}
                        {' · '}
                        {prompt.sensitivity === 'high' ? 'Høy sensitivitet' : 'Lav sensitivitet'}
                      </span>
                      {prompt.submitted_by ? (
                        <Link
                          href={routes.profile(prompt.submitted_by)}
                          className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded hover:underline"
                        >
                          Brukerforslag
                          {prompt.submission_tier === 'curator' ? ' (Kurator)' : ' (Pålitelig)'}
                        </Link>
                      ) : null}
                      {(prompt.topic_tags || []).map((tag) => (
                        <span key={tag} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">{prompt.question}</h2>
                    {prompt.status === 'active' && prompt.expires_at ? (
                      <p className="text-xs text-gray-500 mb-2">
                        Utløper{' '}
                        {new Date(prompt.expires_at).toLocaleString('nb-NO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                    {Array.isArray(prompt.source_headlines) && prompt.source_headlines.length > 0 && (
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
                    )}
                    <div className="flex flex-wrap gap-2">
                      {tab === 'drafts' ? (
                        <>
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
                            disabled={acting === prompt.id}
                            onClick={() => archivePrompt(prompt.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Avvis
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startEdit(prompt)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="w-4 h-4" />
                        Rediger
                      </button>
                      {tab === 'active' ? (
                        <button
                          type="button"
                          disabled={acting === prompt.id}
                          onClick={() => archivePrompt(prompt.id)}
                          className="text-sm text-gray-500 hover:underline"
                        >
                          Arkiver
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
