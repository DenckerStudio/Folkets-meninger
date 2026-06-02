'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Pencil, Plus, X } from 'lucide-react';
import { DEFAULT_REEL_VOTE_OPTIONS } from '@/lib/forum/prompt-vote-options';
import { routes } from '@/lib/routes';

type PromptStatus = 'draft' | 'active' | 'archived';

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
  { id: 'drafts', label: 'Utkast', status: 'draft' },
  { id: 'active', label: 'Aktive', status: 'active' },
  { id: 'archived', label: 'Arkiv', status: 'archived' },
  { id: 'create', label: 'Opprett' },
  { id: 'sources', label: 'Kilder' },
];

export default function AdminForumPromptsClient() {
  const [tab, setTab] = useState<Tab>('drafts');
  const [prompts, setPrompts] = useState<AdminPrompt[]>([]);
  const [sources, setSources] = useState<TrustedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    question: '',
    topic_tags: '',
    sensitivity: 'low',
    sourcesJson: '[]',
  });
  const [createForm, setCreateForm] = useState({
    question: '',
    topic_tags: '',
    sensitivity: 'low',
    status: 'draft' as PromptStatus,
    sourcesJson: '[]',
  });
  const [newSource, setNewSource] = useState({ domain: '', outlet_label: '' });

  const loadPrompts = useCallback(async (status: PromptStatus) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/forum-prompts?status=${status}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ingen tilgang');
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
        setError(data.error || 'Ingen tilgang');
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
    try {
      const res = await fetch('/api/admin/forum-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Feil ved oppdatering');
        return false;
      }
      return true;
    } finally {
      setActing(null);
    }
  };

  const updateStatus = async (id: string, status: 'active' | 'archived') => {
    const ok = await patchPrompt(id, { status });
    if (ok) setPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  const startEdit = (prompt: AdminPrompt) => {
    setEditingId(prompt.id);
    setEditForm({
      question: prompt.question,
      topic_tags: (prompt.topic_tags || []).join(', '),
      sensitivity: prompt.sensitivity,
      sourcesJson: JSON.stringify(prompt.source_headlines || [], null, 2),
    });
  };

  const saveEdit = async (id: string) => {
    let source_headlines: unknown[] = [];
    try {
      source_headlines = JSON.parse(editForm.sourcesJson);
      if (!Array.isArray(source_headlines)) throw new Error('not array');
    } catch {
      setError('Ugyldig JSON for kilder');
      return;
    }
    const ok = await patchPrompt(id, {
      question: editForm.question,
      topic_tags: editForm.topic_tags.split(',').map((t) => t.trim()).filter(Boolean),
      sensitivity: editForm.sensitivity,
      source_headlines,
    });
    if (ok) {
      setEditingId(null);
      const cfg = TABS.find((t) => t.id === tab);
      if (cfg?.status) loadPrompts(cfg.status);
    }
  };

  const submitCreate = async () => {
    setActing('create');
    setError('');
    let source_headlines: unknown[] = [];
    try {
      source_headlines = JSON.parse(createForm.sourcesJson);
      if (!Array.isArray(source_headlines)) throw new Error('not array');
    } catch {
      setError('Ugyldig JSON for kilder');
      setActing(null);
      return;
    }
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
        setError(data.error || 'Kunne ikke opprette');
        return;
      }
      setCreateForm({
        question: '',
        topic_tags: '',
        sensitivity: 'low',
        status: 'draft',
        sourcesJson: '[]',
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
        setError(data.error || 'Kunne ikke legge til kilde');
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
        setError(data.error || 'Feil');
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
      <Link href={routes.forum} className="text-sm text-indigo-600 hover:text-indigo-500 mb-6 inline-block">
        ← Tilbake til forum
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Forum Reels (admin)</h1>
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
        <div className="mb-6 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

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
                <option value="low">low</option>
                <option value="high">high</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Status
              <select
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, status: e.target.value as PromptStatus }))
                }
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Kilder (JSON)
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"
              rows={6}
              value={createForm.sourcesJson}
              onChange={(e) => setCreateForm((f) => ({ ...f, sourcesJson: e.target.value }))}
            />
          </label>
          <button
            type="button"
            disabled={acting === 'create'}
            onClick={submitCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Opprett Reel
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
                    {s.status}
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
                      placeholder="Stikkord"
                      value={editForm.topic_tags}
                      onChange={(e) => setEditForm((f) => ({ ...f, topic_tags: e.target.value }))}
                    />
                    <textarea
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"
                      rows={5}
                      value={editForm.sourcesJson}
                      onChange={(e) => setEditForm((f) => ({ ...f, sourcesJson: e.target.value }))}
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
                        {prompt.status} · {prompt.sensitivity}
                      </span>
                      {(prompt.topic_tags || []).map((tag) => (
                        <span key={tag} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">{prompt.question}</h2>
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
                            onClick={() => updateStatus(prompt.id, 'active')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            Publiser
                          </button>
                          <button
                            type="button"
                            disabled={acting === prompt.id}
                            onClick={() => updateStatus(prompt.id, 'archived')}
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
                          onClick={() => updateStatus(prompt.id, 'archived')}
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
