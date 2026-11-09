import type { ResearchTopicWebhookBody } from '@/lib/admin/research/topic-types';
import { RESEARCH_TOPIC_WEBHOOK_KIND } from '@/lib/admin/research/topic-types';

/** Dokumentert eksempel for n8n-kontrakt (cluster). */
export function buildTopicBriefWebhookPayloadForDocs(): ResearchTopicWebhookBody {
  return {
    request_id: '00000000-0000-4000-8000-000000000001',
    kind: RESEARCH_TOPIC_WEBHOOK_KIND,
    topic_id: '00000000-0000-4000-8000-000000000002',
    source_kind: 'cluster',
    source_ref: '00000000-0000-4000-8000-000000000099',
    title: 'Formueskatt',
    context: {
      action_key: 'opprop:formueskatt',
      summary: 'Opprop om formueskatt og fordeling mellom stat og kommuner.',
    },
    force: false,
  };
}

export function buildTopicBriefWebhookPayloadRedditDocs(): ResearchTopicWebhookBody {
  return {
    request_id: '00000000-0000-4000-8000-000000000003',
    kind: RESEARCH_TOPIC_WEBHOOK_KIND,
    topic_id: '00000000-0000-4000-8000-000000000004',
    source_kind: 'reddit',
    source_ref: '1xlz4r8',
    force: false,
  };
}
