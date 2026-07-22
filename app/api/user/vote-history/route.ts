import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  buildForumVoteInsights,
  ForumVoteHistoryError,
  getUserForumVoteHistory,
} from '@/lib/forum/vote-history-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ items: [], summary: buildForumVoteInsights([]).summary });
    }

    const items = await getUserForumVoteHistory(user.id);
    const insights = buildForumVoteInsights(items);

    return NextResponse.json({
      items,
      summary: insights.summary,
      top_topics: insights.top_topics,
    });
  } catch (error) {
    if (error instanceof ForumVoteHistoryError) {
      console.error('Forum vote history error:', error.message);
    } else {
      console.error('Forum vote history error:', error);
    }
    return NextResponse.json({ items: [], summary: buildForumVoteInsights([]).summary });
  }
}
