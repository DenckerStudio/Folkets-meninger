'use client';

import { SakPageSearch, type SakPageSearchCorpus } from '@/components/sak/sak-page-search';

export function SakPageSearchHost({ corpus }: { corpus: SakPageSearchCorpus }) {
  return <SakPageSearch corpus={corpus} className="w-full" />;
}