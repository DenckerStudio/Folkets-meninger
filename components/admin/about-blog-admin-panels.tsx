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
  aboutBlogDraftFormOverwritesBaseline,
  type AboutBlogDraftFormFields,
} from '@/lib/admin/about-blog-panels';

export type AppliedAboutSuggestion = AboutSuggestionChoice & { token: number };

type DraftOutcome = { suggestionKey: string; ok: boolean };

export function AboutBlogAdminPanels(props: Omit<AboutBlogDraftPanelProps, 'onDraftCreated' | 'onSuggestionDraftFailed' | 'onUserEditedForm' | 'onFormFieldsChange' | 'appliedSuggestion'>) {
  const [applied, setApplied] = useState<AppliedAboutSuggestion | null>(null);
  const [formFields, setFormFields] = useState<AboutBlogDraftFormFields>({ title: '', angle: '' });
  const [appliedBaseline, setAppliedBaseline] = useState<AboutBlogDraftFormFields | null>(null);
  const [draftOutcome, setDraftOutcome] = useState<DraftOutcome | null>(null);
  const [clearUsedMessageSignal, setClearUsedMessageSignal] = useState(0);

  const applySuggestion = useCallback(
    (suggestion: AboutSuggestionChoice) => {
      if (
        aboutBlogDraftFormOverwritesBaseline(formFields, appliedBaseline) &&
        !window.confirm(ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM)
      ) {
        return;
      }
      setAppliedBaseline({ title: suggestion.title, angle: suggestion.angle });
      setApplied({ ...suggestion, token: Date.now() });
    },
    [formFields, appliedBaseline],
  );

  const handleFormFieldsChange = useCallback(
    (fields: AboutBlogDraftFormFields) => {
      setFormFields(fields);
      if (appliedBaseline && aboutBlogDraftFormOverwritesBaseline(fields, appliedBaseline)) {
        setClearUsedMessageSignal((value) => value + 1);
      }
    },
    [appliedBaseline],
  );

  const handleDraftCreated = useCallback((suggestionKey: string) => {
    setDraftOutcome({ suggestionKey, ok: true });
    setAppliedBaseline(null);
  }, []);

  const handleSuggestionDraftFailed = useCallback((suggestionKey: string) => {
    setDraftOutcome({ suggestionKey, ok: false });
  }, []);

  const handleUserEditedForm = useCallback(() => {
    setClearUsedMessageSignal((value) => value + 1);
  }, []);

  const acknowledgeDraftOutcome = useCallback(() => {
    setDraftOutcome(null);
  }, []);

  return (
    <div className="space-y-6">
      <AboutBlogSuggestionsPanel
        onUse={applySuggestion}
        draftOutcome={draftOutcome}
        onDraftOutcomeHandled={acknowledgeDraftOutcome}
        clearUsedMessageSignal={clearUsedMessageSignal}
      />
      <AboutBlogDraftPanel
        {...props}
        appliedSuggestion={applied}
        onFormFieldsChange={handleFormFieldsChange}
        onDraftCreated={handleDraftCreated}
        onSuggestionDraftFailed={handleSuggestionDraftFailed}
        onUserEditedForm={handleUserEditedForm}
      />
    </div>
  );
}