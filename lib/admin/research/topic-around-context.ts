import { loadResearchClusterDetail } from '@/lib/admin/research/cluster-detail';
import { researchTopicRowDisplayTitle } from '@/lib/admin/research/topic-brief-schema';
import { getResearchTopicById } from '@/lib/admin/research/topic-service';
import { buildTopicAroundSearchQuery } from '@/lib/search/topic-around-query';

export type TopicAroundResearchContext =
  | {
      ok: true;
      query: string;
      themeLabel: string;
    }
  | { ok: false; status: 404 };

export async function resolveTopicAroundFromCluster(
  clusterId: string,
): Promise<TopicAroundResearchContext> {
  const detail = await loadResearchClusterDetail(clusterId.trim());
  if (!detail) return { ok: false, status: 404 };
  const title = detail.row.title?.trim() ?? '';
  if (!title) return { ok: false, status: 404 };
  return {
    ok: true,
    themeLabel: title,
    query: buildTopicAroundSearchQuery({ title }),
  };
}

export async function resolveTopicAroundFromTopic(
  topicId: string,
): Promise<TopicAroundResearchContext> {
  const topic = await getResearchTopicById(topicId.trim());
  if (!topic) return { ok: false, status: 404 };
  const themeLabel = researchTopicRowDisplayTitle({
    status: topic.status,
    rawTitle: topic.title,
    output: topic.output,
    redditSubreddit: topic.subreddit,
  });
  if (!themeLabel.trim()) return { ok: false, status: 404 };
  return {
    ok: true,
    themeLabel,
    query: buildTopicAroundSearchQuery({ title: themeLabel }),
  };
}