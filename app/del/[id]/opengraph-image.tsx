import { notFound } from 'next/navigation';
import { getPublicPollById } from '@/lib/polls/service';
import { isShareablePoll } from '@/lib/polls/share';
import {
  OG_IMAGE_ALT,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderPollShareOgImage,
} from '@/lib/polls/share-og';

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

type ImageProps = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { id } = await params;
  const poll = await getPublicPollById(id).catch(() => null);
  if (!poll || !isShareablePoll(poll)) notFound();
  return renderPollShareOgImage(poll);
}
