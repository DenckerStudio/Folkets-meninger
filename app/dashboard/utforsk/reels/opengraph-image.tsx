import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';
import {
  renderShareOgImage,
  SHARE_OG_CONTENT_TYPE,
  SHARE_OG_SIZE,
} from '@/lib/seo/share-og';

/** Keep in sync with SHARE_OG_REVALIDATE_SECONDS (Next.js requires a literal here). */
export const revalidate = 300;
export const alt = 'Reels på Folkets Meninger';
export const size = SHARE_OG_SIZE;
export const contentType = SHARE_OG_CONTENT_TYPE;

export default async function Image() {
  return await renderShareOgImage({
    eyebrow: 'Utforsk',
    title: 'Reels om Stortingssaker',
    description: `Stem ${pollBallotRunningTextPhrase()} og se hva andre mener.`,
    footer: 'folkets-meninger.no · Utforsk',
  });
}
