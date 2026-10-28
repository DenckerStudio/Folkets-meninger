import { getPublicPollById } from '@/lib/polls/service';
import { isShareablePoll } from '@/lib/polls/share';
import {
  OG_IMAGE_ALT,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderPollShareOgImage,
} from '@/lib/polls/share-og';
import { renderShareOgFallback, SHARE_OG_CACHE_CONTROL } from '@/lib/seo/share-og';

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

type ImageProps = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { id } = await params;
  const poll = await getPublicPollById(id).catch(() => null);
  // Unlike `/del`, this URL carries no version param, so a hidden or unknown poll
  // gets the short-lived fallback and real polls a bounded cache, never `immutable`.
  if (!poll || !isShareablePoll(poll)) return renderShareOgFallback('Avstemning');
  return renderPollShareOgImage(poll, SHARE_OG_CACHE_CONTROL);
}
