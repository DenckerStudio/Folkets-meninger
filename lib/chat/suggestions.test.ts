import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChatSuggestions,
  MAX_CHAT_SUGGESTIONS,
  type ChatSuggestionContext,
  type ChatUserSignals,
} from '@/lib/chat/suggestions';
import { FOCUSED_CHAT_TOOL_NAMES } from '@/lib/chat/tools';
import type { ChatViewKind } from '@/lib/chat/view-context';

const emptySignals: ChatUserSignals = {
  categories: [],
  labels: [],
  recentStances: [],
  interests: [],
  ownOpinionTitles: [],
};

function context(partial: Partial<ChatSuggestionContext>): ChatSuggestionContext {
  return { kind: 'general', title: null, issueId: null, ...partial };
}

test('sak context produces grounded, title-aware prompts first', () => {
  const suggestions = buildChatSuggestions({
    context: context({ kind: 'sak', title: 'Strømpriser', issueId: '200365' }),
    signals: emptySignals,
  });
  assert.ok(suggestions.length > 0);
  assert.equal(suggestions[0].source, 'view');
  assert.match(suggestions[0].prompt, /Strømpriser/);
  assert.ok(suggestions.some((s) => s.prompt.includes('votert')));
});

test('sak without a title says «saken», never the raw id', () => {
  const suggestions = buildChatSuggestions({
    context: context({ kind: 'sak', issueId: '200365' }),
    signals: emptySignals,
  });
  assert.ok(suggestions.some((s) => s.prompt.includes('saken')));
  assert.ok(suggestions.every((s) => !s.prompt.includes('200365')));
});

test('signals and interests are added once and never duplicated', () => {
  const signals: ChatUserSignals = {
    categories: [{ value: 'Energi og miljø', count: 4 }],
    labels: [{ value: 'strømpriser', count: 3 }],
    recentStances: [
      { issueId: '111', title: 'Strømpriser', stance: 'enig' },
      { issueId: '222', title: 'Forsvaret', stance: 'uenig' },
      { issueId: '333', title: 'Skole', stance: 'enig' },
    ],
    interests: ['Helse og omsorg'],
    ownOpinionTitles: [],
  };
  const suggestions = buildChatSuggestions({
    context: context({ kind: 'sak', title: 'Strømpriser', issueId: '111' }),
    signals,
  });

  const prompts = suggestions.map((s) => s.prompt.toLowerCase());
  assert.equal(new Set(prompts).size, prompts.length, 'prompts must be unique');
  assert.ok(suggestions.some((s) => s.source === 'signal' && s.prompt.includes('Energi og miljø')));
  assert.ok(suggestions.some((s) => s.source === 'interest' && s.prompt.includes('Helse og omsorg')));
  // Category labels read naturally.
  assert.ok(suggestions.some((s) => s.source === 'signal' && s.label.startsWith('Siste saker innen')));
  // A specific sak is open: never steer toward a different sak.
  assert.ok(!suggestions.some((s) => s.source === 'stance'));
  // The current issue must not be suggested back to itself.
  assert.ok(!suggestions.some((s) => s.prompt.includes('«Strømpriser», og hva er neste steg')));
});

test('stance suggestions appear only off a specific sak, with untruncated titles', () => {
  const longTitle = 'En veldig lang sakstittel som ikke skal klippes av i datalaget i det hele tatt';
  const signals: ChatUserSignals = {
    categories: [],
    labels: [],
    recentStances: [
      { issueId: '222', title: 'Forsvaret', stance: 'uenig' },
      { issueId: '333', title: longTitle, stance: 'enig' },
    ],
    interests: [],
    ownOpinionTitles: [],
  };
  const suggestions = buildChatSuggestions({
    context: context({ kind: 'general' }),
    signals,
  });
  const stance = suggestions.find((s) => s.source === 'stance');
  assert.ok(stance, 'stance suggestion expected off the sak pages');
  assert.ok(suggestions.some((s) => s.source === 'stance' && s.prompt.includes('Forsvaret')));
  assert.ok(suggestions.every((s) => !s.label.includes('…')), 'titles are clamped in the UI, not the data');
  assert.ok(suggestions.some((s) => s.label.includes(longTitle)));
});

test('general context with no signals still returns honest fallbacks', () => {
  const suggestions = buildChatSuggestions({
    context: context({ kind: 'general' }),
    signals: emptySignals,
  });
  assert.equal(suggestions.length, 2);
  assert.ok(suggestions.every((s) => s.source === 'general'));
});

test('mening, reel, horing and politiker get contextual prompts', () => {
  const mening = buildChatSuggestions({
    context: context({ kind: 'mening', title: 'Bedre kollektivtransport', issueId: '55' }),
    signals: emptySignals,
  });
  assert.ok(mening.some((s) => s.prompt.includes('Bedre kollektivtransport')));

  const reel = buildChatSuggestions({
    context: context({ kind: 'reel', title: 'Bør Norge øke fartsgrensene?', issueId: '66' }),
    signals: emptySignals,
  });
  assert.ok(reel.some((s) => s.prompt.includes('Bør Norge øke fartsgrensene?')));

  const horing = buildChatSuggestions({
    context: context({ kind: 'horing', title: 'Høring om ny vei' }),
    signals: emptySignals,
  });
  assert.ok(horing.some((s) => s.prompt.includes('Høring om ny vei')));

  const politiker = buildChatSuggestions({
    context: context({ kind: 'politiker', title: 'Kari Nordmann' }),
    signals: emptySignals,
  });
  assert.ok(politiker.some((s) => s.prompt.includes('Kari Nordmann')));
});

test('result is capped and never surfaces rettskriv or kilder', () => {
  const signals: ChatUserSignals = {
    categories: [
      { value: 'Energi og miljø', count: 5 },
      { value: 'Helse', count: 4 },
    ],
    labels: [
      { value: 'strøm', count: 5 },
      { value: 'skatt', count: 3 },
    ],
    recentStances: Array.from({ length: 6 }, (_, i) => ({
      issueId: String(i),
      title: `Sak ${i}`,
      stance: 'enig',
    })),
    interests: ['Transport', 'Næring'],
    ownOpinionTitles: [],
  };
  const suggestions = buildChatSuggestions({
    context: context({ kind: 'sak', title: 'Strømpriser', issueId: '999' }),
    signals,
  });
  assert.ok(suggestions.length <= MAX_CHAT_SUGGESTIONS);
  const text = suggestions.map((s) => `${s.label} ${s.prompt}`).join(' ').toLowerCase();
  assert.ok(!text.includes('rettskriv'));
  assert.ok(!text.includes('kilder'));
});

test('every suggestion maps to tools the chat model actually has', () => {
  const focused = new Set<string>(FOCUSED_CHAT_TOOL_NAMES);
  const kinds: ChatViewKind[] = [
    'sak',
    'mening',
    'politiker',
    'reel',
    'horing',
    'utforsk',
    'folkets-meninger',
    'horinger',
    'general',
  ];
  const richSignals: ChatUserSignals = {
    categories: [{ value: 'Energi og miljø', count: 4 }],
    labels: [{ value: 'strømpriser', count: 3 }],
    recentStances: [{ issueId: '200365', title: 'Forsvaret', stance: 'for' }],
    interests: ['Helse og omsorg'],
    ownOpinionTitles: [],
  };
  for (const kind of kinds) {
    for (const issueId of [null, '200365']) {
      for (const signals of [emptySignals, richSignals]) {
        const suggestions = buildChatSuggestions({
          context: context({ kind, title: 'Tittel', issueId }),
          signals,
        });
        assert.ok(suggestions.length > 0, `${kind} should have suggestions`);
        for (const suggestion of suggestions) {
          assert.ok(suggestion.tools.length > 0, `${suggestion.id} must name its tools`);
          for (const name of suggestion.tools) {
            assert.ok(focused.has(name), `${kind}/${suggestion.id} relies on ${name}, which the model lacks`);
          }
        }
      }
    }
  }
});

test('visible labels and sent prompts never contain ids', () => {
  const ids = ['200365', 'KANO', 'p-123', '10005945', 'op-77'];
  const idPattern = /\((?:sak|person-id|avstemning|høring|mening|id)\b[^)]*\)|\b(?:person-id|sak-id|poll-id)\b|\bsak \d+|\b\d{5,}\b/i;
  const signals: ChatUserSignals = {
    categories: [{ value: 'Energi og miljø', count: 4 }],
    labels: [],
    recentStances: [{ issueId: '200365', title: 'Forsvaret', stance: 'for' }],
    interests: [],
    ownOpinionTitles: [],
  };
  const kinds: ChatViewKind[] = ['sak', 'mening', 'politiker', 'reel', 'horing', 'general'];
  for (const kind of kinds) {
    for (const title of [null, 'Kari Nordmann']) {
      for (const issueId of [null, '200365']) {
        const suggestions = buildChatSuggestions({ context: context({ kind, title, issueId }), signals });
        for (const suggestion of suggestions) {
          for (const text of [suggestion.label, suggestion.prompt]) {
            assert.doesNotMatch(text, idPattern, `${kind}/${suggestion.id}: «${text}»`);
            for (const id of ids) assert.ok(!text.includes(id), `${kind}/${suggestion.id} leaks ${id}: «${text}»`);
          }
        }
      }
    }
  }
});

test('stance suggestions carry the sak as structured context, not text', () => {
  const suggestions = buildChatSuggestions({
    context: context({ kind: 'general' }),
    signals: {
      ...emptySignals,
      recentStances: [{ issueId: '200365', title: 'Forsvaret', stance: 'for' }],
    },
  });
  const stance = suggestions.find((s) => s.source === 'stance');
  assert.equal(stance?.contextSakId, '200365');
  assert.ok(!stance?.prompt.includes('200365'));
});

test('politician prompts avoid unsourced party lines', () => {
  const politiker = buildChatSuggestions({
    context: context({ kind: 'politiker', title: 'Kari Nordmann' }),
    signals: emptySignals,
  });
  assert.ok(politiker.every((s) => !/linje/i.test(s.prompt)));
  assert.ok(politiker.some((s) => s.tools.includes('getPolitician')));
  const reel = buildChatSuggestions({
    context: context({ kind: 'reel', title: 'Fartsgrenser' }),
    signals: emptySignals,
  });
  assert.ok(reel.some((s) => s.tools.includes('getPollResults')));
});
