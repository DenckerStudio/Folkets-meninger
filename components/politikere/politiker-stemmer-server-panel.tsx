import type { PolitikerOversikt } from '@/lib/stortinget';
import type { PolitikerSakItem } from '@/lib/politiker-profile-data';
import { getPolitikerStemmerBundle } from '@/lib/politiker-profile-stemmer';
import { PolitikerStemmerView } from '@/components/politikere/politiker-stemmer-view';
import { getServerSupabase } from '@/lib/supabase-server';

type PolitikerStemmerServerPanelProps = {
  rep: PolitikerOversikt;
  saker: PolitikerSakItem[];
};

export async function PolitikerStemmerServerPanel({ rep, saker }: PolitikerStemmerServerPanelProps) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const bundle = await getPolitikerStemmerBundle(rep, saker, {
    viewerUserId: user?.id ?? null,
  });
  const repName = [rep.fornavn, rep.etternavn].filter(Boolean).join(' ').trim();
  return (
    <PolitikerStemmerView
      repId={String(rep.id)}
      repName={repName}
      bundle={bundle}
    />
  );
}