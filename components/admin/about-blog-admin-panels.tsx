'use client';

import { useState } from 'react';
import {
  AboutBlogDraftPanel,
  type AboutBlogDraftPanelProps,
} from '@/components/admin/about-blog-draft-panel';
import {
  AboutBlogSuggestionsPanel,
  type AboutSuggestionChoice,
} from '@/components/admin/about-blog-suggestions-panel';

export type AppliedAboutSuggestion = AboutSuggestionChoice & { token: number };

export function AboutBlogAdminPanels(props: AboutBlogDraftPanelProps) {
  const [applied, setApplied] = useState<AppliedAboutSuggestion | null>(null);

  return (
    <div className="space-y-6">
      <AboutBlogSuggestionsPanel
        onUse={(suggestion) => setApplied({ ...suggestion, token: Date.now() })}
      />
      <AboutBlogDraftPanel {...props} appliedSuggestion={applied} />
    </div>
  );
}
