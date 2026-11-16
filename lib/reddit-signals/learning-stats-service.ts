import { getServiceSupabase } from '@/lib/supabase';
import { buildRedditLearningStatsFixture } from '@/lib/reddit-signals/learning-stats-fixture';
import { isRedditSignalsFixturePreviewAllowed } from '@/lib/reddit-signals/preview';
import type {
  RedditLearningStatDimension,
  RedditLearningStatRow,
  RedditLearningStatsResponse,
} from '@/lib/reddit-signals/cluster-types';

type LearningStatsDbRow = {
  dimension: string;
  group_key: string;
  total: number;
  brukt: number;
  ignorert: number;
  auto_ignorert: number;
  blokkert: number;
  avg_ai_relevance: number | string | null;
  brukt_rate: number | string | null;
};

function isMissingViewError(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /reddit_learning_stats|does not exist|undefined_table/i.test(error.message ?? '');
}

function mapRow(row: LearningStatsDbRow): RedditLearningStatRow | null {
  const dimension = row.dimension;
  if (dimension !== 'subreddit' && dimension !== 'topic' && dimension !== 'link_domain') {
    return null;
  }
  const avgRaw = row.avg_ai_relevance;
  const rateRaw = row.brukt_rate;
  const avg =
    avgRaw === null || avgRaw === undefined
      ? null
      : Number(typeof avgRaw === 'string' ? Number.parseFloat(avgRaw) : avgRaw);
  const rate =
    rateRaw === null || rateRaw === undefined
      ? null
      : Number(typeof rateRaw === 'string' ? Number.parseFloat(rateRaw) : rateRaw);

  return {
    dimension: dimension as RedditLearningStatDimension,
    groupKey: row.group_key,
    total: row.total,
    brukt: row.brukt,
    ignorert: row.ignorert,
    autoIgnorert: row.auto_ignorert,
    blokkert: row.blokkert,
    avgAiRelevance: Number.isFinite(avg) ? avg : null,
    bruktRate: Number.isFinite(rate) ? rate : null,
  };
}

export async function loadRedditLearningStatsForAdmin(
  previewParam?: string | null,
): Promise<RedditLearningStatsResponse> {
  if (isRedditSignalsFixturePreviewAllowed(previewParam)) {
    return {
      rows: buildRedditLearningStatsFixture(),
      viewMissing: false,
      viewMissingMessage: null,
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      rows: [],
      viewMissing: true,
      viewMissingMessage:
        'Brukt-rate-statistikk krever service role på serveren (SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return {
      rows: [],
      viewMissing: true,
      viewMissingMessage: 'Kunne ikke koble til databasen for statistikk.',
    };
  }

  const { data, error } = await supabase
    .from('reddit_learning_stats')
    .select(
      'dimension, group_key, total, brukt, ignorert, auto_ignorert, blokkert, avg_ai_relevance, brukt_rate',
    )
    .order('dimension', { ascending: true })
    .order('total', { ascending: false });

  if (error) {
    if (isMissingViewError(error)) {
      return {
        rows: [],
        viewMissing: true,
        viewMissingMessage:
          'Statistikkvisningen er ikke tilgjengelig ennå. En administrator må kjøre den ventende databasemigrasjonen.',
      };
    }
    throw error;
  }

  const rows: RedditLearningStatRow[] = [];
  for (const raw of (data ?? []) as LearningStatsDbRow[]) {
    const mapped = mapRow(raw);
    if (mapped) rows.push(mapped);
  }

  return {
    rows,
    viewMissing: false,
    viewMissingMessage: null,
  };
}