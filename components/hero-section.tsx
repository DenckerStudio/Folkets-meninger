import { fetchLandingOpenPollsSnapshot } from '@/lib/landing/home-data';
import { HeroSectionClient } from '@/components/hero-section-client';

export default async function HeroSection() {
  const pollsSnapshot = await fetchLandingOpenPollsSnapshot();
  return <HeroSectionClient pollsSnapshot={pollsSnapshot} />;
}