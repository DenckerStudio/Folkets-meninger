'use client';

import { useMemo, useState } from 'react';
import {
  SAK_DOCUMENT_FILTER_ALL,
  filterAndSearchSakDocuments,
  type SakDocumentFilterValue,
} from '@/lib/sak/documents-filter';
import { SakDocumentsSection, type DocumentWithStatus } from '@/components/sak/sak-documents-section';
import { SakDocumentsToolbar } from '@/components/sak/sak-documents-toolbar';

export function SakDocumentsPanel({
  sakId,
  initialDocuments,
  initialDocumentId,
}: {
  sakId: string;
  initialDocuments: DocumentWithStatus[];
  initialDocumentId?: string | null;
}) {
  const [filter, setFilter] = useState<SakDocumentFilterValue>(SAK_DOCUMENT_FILTER_ALL);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => filterAndSearchSakDocuments(initialDocuments, filter, query),
    [filter, initialDocuments, query],
  );

  return (
    <div className="space-y-4" data-sak-dokumenter-panel="">
      <SakDocumentsToolbar
        filter={filter}
        query={query}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        resultCount={filtered.length}
      />
      <SakDocumentsSection
        sakId={sakId}
        initialDocuments={filtered}
        initialDocumentId={initialDocumentId}
      />
    </div>
  );
}