import Link from 'next/link';
import { FileText } from 'lucide-react';
import { pickSakDocumentShortlist } from '@/lib/sak/documents-filter';
import { SAK_DOCUMENT_KIND_LABELS, type SakDocumentRef } from '@/lib/stortinget-documents';

type ShortlistDoc = SakDocumentRef & { ingestStatus?: string };

export function SakDocumentsShortlist({
  sakId,
  documents,
}: {
  sakId: string;
  documents: readonly ShortlistDoc[];
}) {
  const shortlist = pickSakDocumentShortlist(documents, 4);
  if (shortlist.length === 0) return null;

  return (
    <section
      id="sak-dokument-kortliste"
      data-sak-dokument-kortliste=""
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <FileText className="h-5 w-5 text-brand" aria-hidden />
          Dokumenter på saken
        </h2>
        <Link href="#dokumenter" className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">
          Alle dokumenter
        </Link>
      </div>
      <ul className="space-y-2">
        {shortlist.map((doc) => (
          <li key={doc.id} id={`sak-dokument-${doc.id}`}>
            <Link
              href={`/dashboard/sak/${encodeURIComponent(sakId)}?dokument=${encodeURIComponent(doc.id)}#dokumenter`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:border-brand/40 hover:bg-brand/5"
            >
              <span className="min-w-0 font-medium break-words text-foreground">{doc.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {SAK_DOCUMENT_KIND_LABELS[doc.kind]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}