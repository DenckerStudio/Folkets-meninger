import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM,
  ABOUT_BLOG_TITLE_INPUT_ID,
  aboutBlogDraftFormIsDirty,
  focusAboutBlogTitleField,
  shouldShowAboutSuggestionsEmptyState,
} from '@/lib/admin/about-blog-panels';

assert.equal(aboutBlogDraftFormIsDirty({ title: '', angle: '' }), false);
assert.equal(aboutBlogDraftFormIsDirty({ title: '  ', angle: '' }), false);
assert.equal(aboutBlogDraftFormIsDirty({ title: 'Ny tittel', angle: '' }), true);
assert.equal(aboutBlogDraftFormIsDirty({ title: '', angle: 'Vinkling' }), true);

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
assert.match(adminPanels, /aboutBlogDraftFormIsDirty/);
assert.match(adminPanels, /window\.confirm/);

const draftPanel = readFileSync(
  join(process.cwd(), 'components/admin/about-blog-draft-panel.tsx'),
  'utf8',
);
assert.match(draftPanel, /focusAboutBlogTitleField/);

console.log('lib/admin/about-blog-panels.test.ts: ok');