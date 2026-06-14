'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Gavel,
  Loader2,
  Search,
  Shield,
  X,
} from 'lucide-react';
import {
  contextItemKey,
  type ForumContextItem,
  type ForumContextKind,
} from '@/lib/forum/context';

const TAB_CONFIG: { id: 'all' | ForumContextKind; label: string; icon: typeof Search }[] = [
  { id: 'all', label: 'Alle', icon: Search },
  { id: 'sak', label: 'Saker', icon: FileText },
  { id: 'hearing', label: 'Høringer', icon: Gavel },
  { id: 'politician', label: 'Politikere', icon: Shield },
];

const KIND_LABEL: Record<ForumContextKind, string> = {
  sak: 'Sak',
  hearing: 'Høring',
  politician: 'Politiker',
  document: 'Dokument',
};

type ContextPickerProps = {
  onSelect: (item: ForumContextItem) => void;
  selectedKeys?: Set<string>;
  placeholder?: string;
  compact?: boolean;
};

export default function ContextPicker({
  onSelect,
  selectedKeys = new Set(),
  placeholder = 'Søk etter sak, høring eller politiker…',
  compact = false,
}: ContextPickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | ForumContextKind>('all');
  const [results, setResults] = useState<ForumContextItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: debouncedQuery,
        type: activeTab,
        limit: '8',
      });
      const res = await fetch(`/api/forum/context-search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedQuery]);

  useEffect(() => {
    if (open) {
      fetchResults();
    }
  }, [open, fetchResults]);

  const visibleResults = useMemo(
    () => results.filter((item) => !selectedKeys.has(contextItemKey(item))),
    [results, selectedKeys]
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-lg pl-10 pr-3 focus:ring-indigo-500 focus:border-indigo-500 text-sm ${
            compact ? 'py-2' : 'py-2.5'
          }`}
        />
      </div>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Lukk søk"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="flex gap-1 p-2 border-b border-gray-100 bg-gray-50 overflow-x-auto">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Søker…
                </div>
              ) : visibleResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  {debouncedQuery ? 'Ingen treff. Prøv et annet søkeord.' : 'Skriv for å søke, eller bla i kategoriene.'}
                </p>
              ) : (
                visibleResults.map((item) => (
                  <button
                    key={contextItemKey(item)}
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {KIND_LABEL[item.kind]}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ContextChip({
  item,
  onRemove,
  onPrimary,
  isPrimary,
}: {
  item: ForumContextItem;
  onRemove?: () => void;
  onPrimary?: () => void;
  isPrimary?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-sm ${
        isPrimary
          ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
          : 'border-gray-200 bg-white text-gray-800'
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium truncate max-w-[220px]">{item.title}</p>
        <p className="text-xs opacity-70">{KIND_LABEL[item.kind]}{isPrimary ? ' · Hovedsak' : ''}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onPrimary && item.kind === 'sak' && !isPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 px-1"
          >
            Sett som hovedsak
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-0.5 rounded hover:bg-black/5 text-gray-500"
            aria-label="Fjern"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
