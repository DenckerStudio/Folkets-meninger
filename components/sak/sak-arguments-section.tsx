import { buildSakArgumentsBundle } from '@/lib/sak/arguments/build-arguments';
import { loadSakMerknadChunks } from '@/lib/sak/arguments/load-merknad-chunks';
import { getIssueOpinionSummary, listCitizenOpinionsByIssue } from '@/lib/opinions/service';
import { SakArgumentsProsCons } from '@/components/sak/sak-arguments-pros-cons';

export async function SakArgumentsSection({
  sakId,
  innstillingstekst,
}: {
  sakId: string;
  innstillingstekst: string | null | undefined;
}) {
  const [merknadChunks, opinionSummary, opinions] = await Promise.all([
    loadSakMerknadChunks(sakId),
    getIssueOpinionSummary(sakId, 0).catch(() => ({ total: 0, counts: { for: 0, blank: 0, imot: 0 }, latest: [] })),
    listCitizenOpinionsByIssue(sakId, 80).catch(() => []),
  ]);

  const bundle = buildSakArgumentsBundle({
    sakId,
    innstillingstekst,
    merknadChunks,
    opinions,
    totalOpinions: opinionSummary.total,
  });

  return <SakArgumentsProsCons bundle={bundle} />;
}