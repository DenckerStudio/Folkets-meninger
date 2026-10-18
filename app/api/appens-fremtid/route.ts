import { NextResponse } from 'next/server';
import { isChangelogPublished } from '@/lib/appens-fremtid/changelog';
import { listAppChangelogEntries, listAppRoadmapItems } from '@/lib/admin/app-future';
import { listVotingAppSuggestions } from '@/lib/admin/suggestions';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  try {
    const [suggestions, changelog, roadmap] = await Promise.all([
      listVotingAppSuggestions(user.id).catch(() => []),
      listAppChangelogEntries().catch(() => []),
      listAppRoadmapItems().catch(() => []),
    ]);
    const publicChangelog = changelog.filter(isChangelogPublished);
    return NextResponse.json({ suggestions, changelog: publicChangelog, roadmap });
  } catch (error) {
    console.error('[appens-fremtid] list failed', error);
    return NextResponse.json(
      { suggestions: [], changelog: [], roadmap: [], error: 'Kunne ikke laste Appens fremtid.' },
      { status: 200 },
    );
  }
}
