'use client';

import { useState } from 'react';
import { SAK_DOCUMENT_FILTER_ALL, type SakDocumentFilterValue } from '@/lib/sak/documents-filter';
import { SakDocumentsSection, type DocumentWithStatus } from '@/components/sak/sak-documents-section';
import { SakDocumentsToolbar } from '@/components/sak/sak-documents-toolbar';
import { filterAndSearchSakDocuments } from '@/lib/sak/documents-filter';

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

  const filteredCount = filterAndSearchSakDocuments(initialDocuments, filter, query).length;
  const filterActive = filter !== SAK_DOCUMENT_FILTER_ALL || query.trim().length > 0;
  const clearFilters = () => {
    setFilter(SAK_DOCUMENT_FILTER_ALL);
    setQuery('');
  };

  return (
    <div className="space-y-4" data-sak-dokumenter-panel="">
      <SakDocumentsToolbar
        filter={filter}
        query={query}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        resultCount={filteredCount}
      />
      <SakDocumentsSection
        sakId={sakId}
        seedDocuments={initialDocuments}
        initialDocumentId={initialDocumentId}
        filter={filter}
        titleQuery={query}
        onClearFilters={filterActive ? clearFilters : undefined}
      />
    </div>
  );
}