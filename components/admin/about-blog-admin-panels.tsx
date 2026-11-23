'use client';

import { useCallback, useState } from 'react';
import {
  AboutBlogDraftPanel,
  type AboutBlogDraftPanelProps,
} from '@/components/admin/about-blog-draft-panel';
import {
  AboutBlogSuggestionsPanel,
  type AboutSuggestionChoice,
} from '@/components/admin/about-blog-suggestions-panel';
import {
  ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM,
  aboutBlogDraftFormIsDirty,
  type AboutBlogDraftFormFields,
} from '@/lib/admin/about-blog-panels';

export type AppliedAboutSuggestion = AboutSuggestionChoice & { token: number };

export function AboutBlogAdminPanels(props: AboutBlogDraftPanelProps) {
  const [applied, setApplied] = useState<AppliedAboutSuggestion | null>(null);
  const [formFields, setFormFields] = useState<AboutBlogDraftFormFields>({ title: '', angle: '' });

  const applySuggestion = useCallback(
    (suggestion: AboutSuggestionChoice) => {
      if (aboutBlogDraftFormIsDirty(formFields) && !window.confirm(ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM)) {
        return;
      }
      setApplied({ ...suggestion, token: Date.now() });
    },
    [formFields],
  );

  return (
    <div className="space-y-6">
      <AboutBlogSuggestionsPanel onUse={applySuggestion} />
      <AboutBlogDraftPanel {...props} appliedSuggestion={applied} onFormFieldsChange={setFormFields} />
    </div>
  );
}
