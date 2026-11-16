import { unstable_noStore as noStore } from 'next/cache';
import { fetchLandingOpenPollsSnapshot } from '@/lib/landing/home-data';
import { HeroSectionClient } from '@/components/hero-section-client';

export default async function HeroSection() {
  const pollsSnapshot = await fetchLandingOpenPollsSnapshot();
  if (pollsSnapshot === null) {
    noStore();
  }
  return <HeroSectionClient pollsSnapshot={pollsSnapshot} />;
}