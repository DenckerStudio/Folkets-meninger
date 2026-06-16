'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import {
  groupSakDocumentsByKind,
  SAK_DOCUMENT_KIND_LABELS,
  type SakDocumentKind,
  type SakDocumentRef,
} from '@/lib/stortinget-documents';

type DocumentWithStatus = SakDocumentRef & {
  ingestStatus: string;
};

type DocumentContentResponse =
  | { status: 'ready'; html: string; title: string }
  | { status: 'pending'; retry_after_seconds?: number }
  | { status: 'external_only'; sourceUrl: string | null; title: string }
  | { status: 'failed'; sourceUrl: string | null; title: string };

function statusLabel(status: string, viewable: boolean): string {
  if (status === 'ready') return 'Klar';
  if (status === 'pending') return 'Henter dokument …';
  if (status === 'failed') return 'Kunne ikke hente';
  if (status === 'external_only' || !viewable) return 'Eksternt dokument';
  return 'Venter';
}

function SakDocumentViewer({
  sakId,
  document,
  onClose,
}: {
  sakId: string;
  document: DocumentWithStatus;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<DocumentContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const maxAttempts = 8;
      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt += 1) {
        try {
          const res = await fetch(`/api/sak/${sakId}/documents/${encodeURIComponent(document.id)}/content`);
          const json = (await res.json().catch(() => ({}))) as DocumentContentResponse;

          if (cancelled) return;

          if (json.status === 'ready' || json.status === 'external_only' || json.status === 'failed') {
            setContent(json);
            setLoading(false);
            return;
          }

          const retryAfter =
            typeof json.retry_after_seconds === 'number' && json.retry_after_seconds > 0
              ? json.retry_after_seconds
              : 5;
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        } catch {
          if (!cancelled) {
            setError('Kunne ikke laste dokumentet.');
            setLoading(false);
          }
          return;
        }
      }

      if (!cancelled) {
        setError('Dokumentet er ikke klart ennå. Prøv igjen om litt.');
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sakId, document.id]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={document.title}
      description={SAK_DOCUMENT_KIND_LABELS[document.kind]}
      size="xl"
      footer={
        document.sourceUrl ? (
          <a
            href={document.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <ExternalLink className="h-4 w-4" />
            Åpne originalkilde
          </a>
        ) : null
      }
    >
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          Laster dokument …
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
          {document.sourceUrl ? (
            <div className="mt-3">
              <a
                href={document.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-indigo-700 hover:text-indigo-600"
              >
                <ExternalLink className="h-4 w-4" />
                Åpne på ekstern side
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && content?.status === 'external_only' ? (
        <div className="space-y-3 text-sm text-gray-700">
          <p>Dette dokumentet ligger på en ekstern side og kan ikke vises direkte i appen.</p>
          {content.sourceUrl ? (
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-500"
            >
              <ExternalLink className="h-4 w-4" />
              Åpne {content.title}
            </a>
          ) : (
            <p className="text-gray-500">Ingen direkte lenke tilgjengelig.</p>
          )}
        </div>
      ) : null}

      {!loading && content?.status === 'failed' ? (
        <div className="space-y-3 text-sm text-gray-700">
          <p>Vi klarte ikke å hente dokumentet fra Stortingets åpne data.</p>
          {content.sourceUrl ? (
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-500"
            >
              <ExternalLink className="h-4 w-4" />
              Åpne originalkilde
            </a>
          ) : null}
        </div>
      ) : null}

      {!loading && content?.status === 'ready' ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <iframe
            title={content.title}
            srcDoc={content.html}
            className="h-[min(70vh,720px)] w-full bg-white"
            sandbox="allow-same-origin"
          />
        </div>
      ) : null}
    </Dialog>
  );
}

export function SakDocumentsSection({
  sakId,
  initialDocuments,
}: {
  sakId: string;
  initialDocuments: DocumentWithStatus[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [activeDocument, setActiveDocument] = useState<DocumentWithStatus | null>(null);

  const refreshStatuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/sak/${sakId}/documents`);
      if (!res.ok) return;
      const json = (await res.json()) as { documents?: DocumentWithStatus[] };
      if (Array.isArray(json.documents)) {
        setDocuments(json.documents);
      }
    } catch {
      // Keep initial server-rendered list on failure.
    }
  }, [sakId]);

  useEffect(() => {
    const hasPending = documents.some((doc) => doc.ingestStatus === 'pending');
    if (!hasPending) return;

    const timer = window.setInterval(() => {
      void refreshStatuses();
    }, 8_000);

    return () => window.clearInterval(timer);
  }, [documents, refreshStatuses]);

  if (documents.length === 0) return null;

  const groups = groupSakDocumentsByKind(documents);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900">Tilknyttede dokumenter</h2>
        </div>

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.kind}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {group.label}
              </h3>
              <ul className="space-y-2">
                {group.documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => setActiveDocument(doc)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-colors hover:border-indigo-100 hover:bg-indigo-50/60"
                    >
                      <span className="text-sm font-medium text-gray-900">{doc.title}</span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {statusLabel(doc.ingestStatus, doc.viewable)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {activeDocument ? (
        <SakDocumentViewer
          sakId={sakId}
          document={activeDocument}
          onClose={() => setActiveDocument(null)}
        />
      ) : null}
    </>
  );
}

export type { DocumentWithStatus, SakDocumentKind };
