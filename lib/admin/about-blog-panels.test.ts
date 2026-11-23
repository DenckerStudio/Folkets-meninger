import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ABOUT_BLOG_SUGGESTION_CONSUMED_MESSAGE,
  ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM,
  ABOUT_BLOG_SUGGESTION_PICKED_MESSAGE,
  ABOUT_BLOG_TITLE_INPUT_ID,
  aboutBlogDraftFormIsDirty,
  aboutBlogDraftFormOverwritesBaseline,
  formatAboutBlogSuggestionDraftFailure,
  focusAboutBlogTitleField,
  shouldShowAboutSuggestionsEmptyState,
} from '@/lib/admin/about-blog-panels';

assert.equal(aboutBlogDraftFormIsDirty({ title: '', angle: '' }), false);
assert.equal(aboutBlogDraftFormIsDirty({ title: '  ', angle: '' }), false);
assert.equal(aboutBlogDraftFormIsDirty({ title: 'Ny tittel', angle: '' }), true);
assert.equal(aboutBlogDraftFormIsDirty({ title: '', angle: 'Vinkling' }), true);

assert.equal(
  aboutBlogDraftFormOverwritesBaseline(
    { title: 'Fra forslag', angle: 'Vinkling' },
    { title: 'Fra forslag', angle: 'Vinkling' },
  ),
  false,
);
assert.equal(
  aboutBlogDraftFormOverwritesBaseline(
    { title: 'Fra forslag', angle: 'Endret' },
    { title: 'Fra forslag', angle: 'Vinkling' },
  ),
  true,
);

assert.match(
  formatAboutBlogSuggestionDraftFailure('Ukjent kategori'),
  /Utkastet feilet: Ukjent kategori\. Forslaget kan brukes på nytt\./,
);
assert.equal(
  formatAboutBlogSuggestionDraftFailure('  '),
  'Utkastet feilet. Forslaget kan brukes på nytt.',
);

assert.equal(
  shouldShowAboutSuggestionsEmptyState({
    loading: false,
    hasError: true,
    tableMessage: false,
    suggestionCount: 0,
  }),
  false,
);
assert.equal(
  shouldShowAboutSuggestionsEmptyState({
    loading: true,
    hasError: false,
    tableMessage: false,
    suggestionCount: 0,
  }),
  false,
);
assert.equal(
  shouldShowAboutSuggestionsEmptyState({
    loading: false,
    hasError: false,
    tableMessage: false,
    suggestionCount: 0,
  }),
  true,
);

let focused = false;
let scrolled = false;
focusAboutBlogTitleField({
  getElementById: (id) => {
    assert.equal(id, ABOUT_BLOG_TITLE_INPUT_ID);
    return {
      focus: () => {
        focused = true;
      },
      scrollIntoView: () => {
        scrolled = true;
      },
    };
  },
});
assert.equal(focused, true);
assert.equal(scrolled, true);

const suggestionsPanel = readFileSync(
  join(process.cwd(), 'components/admin/about-blog-suggestions-panel.tsx'),
  'utf8',
);
assert.match(suggestionsPanel, /shouldShowAboutSuggestionsEmptyState/);
assert.match(suggestionsPanel, /hasError: Boolean\(error\)/);
assert.match(suggestionsPanel, /role="status"/);
assert.match(suggestionsPanel, /focus-visible:ring-ring/);
assert.match(suggestionsPanel, /setError\(''\)/);
assert.match(suggestionsPanel, /Prøv igjen/);

const adminPanels = readFileSync(
  join(process.cwd(), 'components/admin/about-blog-admin-panels.tsx'),
  'utf8',
);
assert.match(adminPanels, /ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM/);
assert.match(adminPanels, /aboutBlogDraftFormOverwritesBaseline/);
assert.match(adminPanels, /window\.confirm/);
assert.match(adminPanels, /onDraftCreated=\{handleDraftCreated\}/);
assert.match(adminPanels, /draftOutcome=\{draftOutcome\}/);

assert.match(suggestionsPanel, /ABOUT_BLOG_SUGGESTION_PICKED_MESSAGE/);
assert.match(suggestionsPanel, /ABOUT_BLOG_SUGGESTION_CONSUMED_MESSAGE/);
assert.match(suggestionsPanel, /draftOutcome/);
assert.match(suggestionsPanel, /clearUsedMessageSignal/);

const draftPanel = readFileSync(
  join(process.cwd(), 'components/admin/about-blog-draft-panel.tsx'),
  'utf8',
);
assert.match(draftPanel, /focusAboutBlogTitleField/);
assert.match(draftPanel, /onDraftCreated\?\./);
assert.match(draftPanel, /formatAboutBlogSuggestionDraftFailure/);
assert.match(draftPanel, /onSuggestionDraftFailed\?\./);
assert.match(draftPanel, /onUserEditedForm\?\./);

console.log('lib/admin/about-blog-panels.test.ts: ok');