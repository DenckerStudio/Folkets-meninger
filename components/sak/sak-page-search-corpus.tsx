import { getIssueOpinionSummary, listCitizenOpinionsByIssue } from '@/lib/opinions/service';
import { buildSakArgumentsBundle } from '@/lib/sak/arguments/build-arguments';
import { loadSakMerknadChunks } from '@/lib/sak/arguments/load-merknad-chunks';
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
  const [merknadChunks, opinionSummary, opinions] = await Promise.all([
    loadSakMerknadChunks(sakId),
    getIssueOpinionSummary(sakId, 0).catch(() => ({
      total: 0,
      counts: { for: 0, blank: 0, imot: 0 },
      latest: [],
    })),
    listCitizenOpinionsByIssue(sakId, 80).catch(() => []),
  ]);

  const bundle = buildSakArgumentsBundle({
    sakId,
    innstillingstekst,
    merknadChunks,
    opinions,
    totalOpinions: opinionSummary.total,
  });

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
    argumentSnippets: [...bundle.for, ...bundle.mot].map((item) => ({
      id: item.id,
      text: item.text,
      side: item.side,
    })),
  };

  return <SakPageSearchHost corpus={corpus} />;
}