import { listCitizenOpinionsByIssue } from '@/lib/opinions/service';
import { extractInnstillingArguments } from '@/lib/sak/arguments/extract-innstilling';
import { SakPageSearchHost } from '@/components/sak/sak-page-search-host';
import type { SakPageSearchCorpus } from '@/components/sak/sak-page-search';
import type { SakDocumentRef } from '@/lib/stortinget-documents';

export async function SakPageSearchCorpus({
  sakId,
  title,
  summary,
  documents,
  innstillingstekst,
}: {
  sakId: string;
  title: string;
  summary: string | null;
  documents: readonly Pick<SakDocumentRef, 'id' | 'title'>[];
  innstillingstekst: string | null | undefined;
}) {
  const opinions = await listCitizenOpinionsByIssue(sakId, 40).catch(() => []);
  const argumentItems = extractInnstillingArguments(innstillingstekst);
  const corpus: SakPageSearchCorpus = {
    title,
    summary,
    documents,
    opinions: opinions.map((opinion) => ({
      id: opinion.id,
      title: opinion.title,
      body: opinion.body,
    })),
    innstillingSnippet: innstillingstekst?.trim() ? innstillingstekst.trim() : null,
    argumentSnippets: argumentItems.map((item) => ({
      id: item.id,
      text: item.text,
      side: item.side,
    })),
  };

  return <SakPageSearchHost corpus={corpus} />;
}