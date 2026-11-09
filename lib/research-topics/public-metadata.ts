import { buildPageMetadata, truncateDescription } from '@/lib/seo/metadata';
import type { PublicResearchTopicDetail } from '@/lib/research-topics/public-map';
import { routes } from '@/lib/routes';

export function buildPublicResearchTopicsIndexMetadata() {
  return buildPageMetadata({
    title: 'Dette snakkes det om',
    description:
      'Oversikt over temaer vi har kartlagt ut fra offentlige kilder — regler, partiforslag, medier og meningsmålinger.',
    canonicalPath: routes.detteSnakkesDetOm,
  });
}

export function buildPublicResearchTopicDetailMetadata(topic: PublicResearchTopicDetail) {
  const description =
    topic.teaser?.trim() ||
    truncateDescription(
      topic.sections.currentRules[0] ??
        topic.sections.mediaCoverage[0]?.headline ??
        topic.topicTitle,
    );
  return buildPageMetadata({
    title: topic.topicTitle,
    description,
    canonicalPath: routes.detteSnakkesDetOmTopic(topic.id),
    openGraphType: 'article',
  });
}
