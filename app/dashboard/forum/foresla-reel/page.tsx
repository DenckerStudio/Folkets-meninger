import type { Metadata } from 'next';
import { ForeslaReelClient } from './foresla-reel-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Foreslå reel | Forum',
  description: 'Foreslå forum-reels når du har nok poeng og tillit.',
};

export default function ForeslaReelPage() {
  return <ForeslaReelClient />;
}
