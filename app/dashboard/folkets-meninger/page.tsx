import {
  getSakPickerOption,
  listCitizenOpinions,
  listCitizenOpinionsByIssue,
  listSakPickerOptions,
} from '@/lib/opinions/service';
import { FolketsMeningerClient } from '@/components/opinions/folkets-meninger-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Folkets meninger',
  description:
    'Les og del meninger om Stortingssaker. Ett innlegg per bruker, med for- og imot-punkter.',
  canonicalPath: '/dashboard/folkets-meninger',
});

type PageProps = {
  searchParams?: Promise<{ sak?: string | string[]; compose?: string | string[] }>;
};

export default async function FolketsMeningerPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const sakParam = resolved?.sak;
  const issueId = typeof sakParam === 'string' && sakParam.trim() ? sakParam.trim() : null;
  const composeParam = resolved?.compose;
  const initialCompose = composeParam === '1' || composeParam === 'true';

  const [opinions, sakOptions] = await Promise.all([
    issueId ? listCitizenOpinionsByIssue(issueId, 40) : listCitizenOpinions(40),
    listSakPickerOptions(300),
  ]);

  let options = sakOptions;
  if (issueId && !options.some((option) => option.id === issueId)) {
    const scoped = await getSakPickerOption(issueId);
    if (scoped) options = [scoped, ...options];
  }

  return (
    <FolketsMeningerClient
      opinions={opinions}
      sakOptions={options}
      issueId={issueId}
      initialCompose={initialCompose}
    />
  );
}
