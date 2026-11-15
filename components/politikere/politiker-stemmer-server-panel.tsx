import type { PolitikerOversikt } from '@/lib/stortinget';
import type { PolitikerSakItem } from '@/lib/politiker-profile-data';
import { getPolitikerStemmerBundle } from '@/lib/politiker-profile-stemmer';
import { PolitikerStemmerView } from '@/components/politikere/politiker-stemmer-view';

type PolitikerStemmerServerPanelProps = {
  rep: PolitikerOversikt;
  saker: PolitikerSakItem[];
};

export async function PolitikerStemmerServerPanel({ rep, saker }: PolitikerStemmerServerPanelProps) {
  const bundle = await getPolitikerStemmerBundle(rep, saker);
  const repName = [rep.fornavn, rep.etternavn].filter(Boolean).join(' ').trim();
  return (
    <PolitikerStemmerView
      repId={String(rep.id)}
      repName={repName}
      bundle={bundle}
    />
  );
}