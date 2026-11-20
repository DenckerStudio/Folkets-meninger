import assert from 'node:assert/strict';
import {
  ABOUT_BLOG_ANGLE_MAX,
  ABOUT_BLOG_CATEGORY_SLUG,
  ABOUT_BLOG_PROMPT_VERSION,
  ABOUT_BLOG_SOURCE_PREFIX,
  aboutBlogExcerpt,
  aboutBlogProductFacts,
  aboutBlogSlug,
  aboutBlogSourceEvent,
  buildAboutBlogDraftInput,
  buildAboutBlogPrompt,
  findForbiddenAboutTerms,
  parseAboutDraftRequest,
} from '@/lib/blog/about-draft';
import { isValidBlogSlug } from '@/lib/blog/slug';
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX } from '@/lib/blog/text-limits';

const REQUEST_ID = '3f2b8c1a-9d4e-4f6a-8b7c-1e2d3c4b5a69';

const envSnapshot = {
  ANSWER_LLM_URL: process.env.ANSWER_LLM_URL,
  ANSWER_LLM_MODEL: process.env.ANSWER_LLM_MODEL,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureLlm() {
  process.env.ANSWER_LLM_URL = 'http://llm.example.test';
  process.env.ANSWER_LLM_MODEL = 'test-model';
}

function llmFetch(response: string, seenPrompts: string[] = []): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { prompt: string };
    seenPrompts.push(payload.prompt);
    return new Response(JSON.stringify({ response, done: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

function testForbiddenTerms() {
  assert.deepEqual(findForbiddenAboutTerms('Logg inn med BankID eller MinID.'), ['BankID', 'MinID']);
  assert.deepEqual(findForbiddenAboutTerms('Bruk Bank-ID.'), ['BankID']);
  assert.deepEqual(findForbiddenAboutTerms('Tidligere het vi Folkets Stemme.'), ['Folkets Stemme']);
  assert.deepEqual(findForbiddenAboutTerms('Se folkets-stemme.no'), ['folkets-stemme.no']);
  assert.deepEqual(findForbiddenAboutTerms('Vi leste det på Reddit.'), ['Reddit']);

  assert.deepEqual(findForbiddenAboutTerms('Vi sammenligner folkets stemmer med Stortinget.'), []);
  assert.deepEqual(findForbiddenAboutTerms('Stemme+ er valgfritt. Det var min idé.'), []);
  assert.deepEqual(findForbiddenAboutTerms('Folkets Meninger viser folkets stemmetall.'), []);
}

function testProductFacts() {
  const facts = aboutBlogProductFacts();
  assert.ok(facts.length > 5);
  const joined = facts.join('\n');
  assert.deepEqual(findForbiddenAboutTerms(joined), []);
  assert.match(joined, /Ja, Nei eller Blank/);
  assert.match(joined, /Stemme\+/);
  assert.doesNotMatch(joined, /Vet ikke/i);
}

function testPrompt() {
  const prompt = buildAboutBlogPrompt({
    title: 'Hvorfor vi lagde Folkets Meninger',
    angle: 'Legg vekt på at tallene er ærlige',
  });
  assert.match(prompt, /Tittel: Hvorfor vi lagde Folkets Meninger/);
  assert.match(prompt, /Vinkling fra redaksjonen: Legg vekt på at tallene er ærlige/);
  assert.match(prompt, /norsk bokmål/);
  assert.match(prompt, /Ikke nevn BankID, MinID eller Reddit\./);
  assert.match(prompt, /Ikke bruk «Folkets Stemme» eller folkets-stemme\.no\./);
  assert.match(prompt, /Ikke finn opp tall/);
  assert.match(prompt, /bare valgene Ja, Nei og Blank/);
  for (const fact of aboutBlogProductFacts()) {
    assert.ok(prompt.includes(fact), `prompt mangler fakta: ${fact.slice(0, 40)}`);
  }

  const withoutAngle = buildAboutBlogPrompt({ title: 'Slik virker avstemninger', angle: '   ' });
  assert.match(withoutAngle, /Ingen vinkling oppgitt/);
}

function testParseRequest() {
  const ok = parseAboutDraftRequest({
    title: '  Slik virker avstemninger  ',
    angle: '  Kort og konkret ',
    request_id: REQUEST_ID.toUpperCase(),
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.value, {
      title: 'Slik virker avstemninger',
      angle: 'Kort og konkret',
      requestId: REQUEST_ID,
    });
  }

  const minimal = parseAboutDraftRequest({ title: 'Om oss' });
  assert.equal(minimal.ok, true);
  if (minimal.ok) {
    assert.equal(minimal.value.angle, null);
    assert.equal(minimal.value.requestId, null);
  }

  const emptyAngle = parseAboutDraftRequest({ title: 'Om oss', angle: '   ' });
  assert.equal(emptyAngle.ok && emptyAngle.value.angle, null);

  for (const [body, pattern] of [
    [null, /^Ugyldig forespørsel$/],
    ['Om oss', /^Ugyldig forespørsel$/],
    [{}, /Tittel mangler/],
    [{ title: 42 }, /Tittel mangler/],
    [{ title: 'Om oss', angle: 7 }, /Vinklingen må være tekst/],
    [{ title: 'Om oss', request_id: 7 }, /gyldig UUID/],
    [{ title: '  a ' }, /minst 3 tegn/],
    [{ title: 'x'.repeat(BLOG_TITLE_MAX + 1) }, /maks 110 tegn/],
    [{ title: 'Om oss', angle: 'x'.repeat(ABOUT_BLOG_ANGLE_MAX + 1) }, /maks 600 tegn/],
    [{ title: 'Om oss', request_id: 'not-a-uuid' }, /gyldig UUID/],
    [{ title: 'Derfor bruker vi BankID' }, /kan ikke inneholde: BankID/],
    [{ title: 'Om oss', angle: 'Nevn Folkets Stemme og Reddit' }, /Folkets Stemme, Reddit/],
  ] as const) {
    const result = parseAboutDraftRequest(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    if (!result.ok) assert.match(result.message, pattern);
  }
}

function testSlugAndSourceEvent() {
  assert.equal(ABOUT_BLOG_CATEGORY_SLUG, 'om-folkets-meninger');
  assert.equal(aboutBlogSourceEvent(REQUEST_ID), `about:${REQUEST_ID}`);
  assert.ok(aboutBlogSourceEvent(REQUEST_ID).startsWith(ABOUT_BLOG_SOURCE_PREFIX));

  assert.equal(aboutBlogSlug('Hvorfor vi lagde Folkets Meninger'), 'hvorfor-vi-lagde-folkets-meninger');
  assert.equal(aboutBlogSlug('Om oss', REQUEST_ID), 'om-oss-3f2b8c1a');

  const long = aboutBlogSlug('æøå '.repeat(27).trim(), REQUEST_ID);
  assert.ok(isValidBlogSlug(long), long);
  assert.ok(long.endsWith('-3f2b8c1a'));
}

function testExcerpt() {
  assert.equal(
    aboutBlogExcerpt('## Bakgrunn\n\nKort **ingress** her.\n\nNeste avsnitt.', 'Tittel'),
    'Kort ingress her.',
  );
  assert.equal(aboutBlogExcerpt('## Bare overskrift', 'Tittel'), 'Tittel');

  const firstSentence = `${'Vi følger sakene fra Stortinget '.repeat(4).trim()}.`;
  const longParagraph = `${firstSentence} ${'ord '.repeat(120).trim()}.`;
  assert.equal(aboutBlogExcerpt(longParagraph, 'Tittel'), firstSentence);

  const oneLongSentence = `${'ord '.repeat(120).trim()}.`;
  const clipped = aboutBlogExcerpt(oneLongSentence, 'Tittel');
  assert.ok(clipped.length <= BLOG_EXCERPT_MAX, String(clipped.length));
  assert.ok(clipped.endsWith('ord…'), clipped.slice(-10));
}

async function testBuildDraftInput() {
  const base = { title: 'Slik virker avstemninger', requestId: REQUEST_ID, slug: 'slik-virker-avstemninger' };

  delete process.env.ANSWER_LLM_URL;
  delete process.env.ANSWER_LLM_MODEL;
  delete process.env.OLLAMA_BASE_URL;
  const unconfigured = await buildAboutBlogDraftInput(base);
  assert.equal(unconfigured.ok, false);
  if (!unconfigured.ok) assert.equal(unconfigured.code, 'llm_unconfigured');

  configureLlm();

  const invalidSlug = await buildAboutBlogDraftInput({ ...base, slug: '' });
  assert.equal(invalidSlug.ok, false);
  if (!invalidSlug.ok) assert.equal(invalidSlug.code, 'invalid_slug');

  const prompts: string[] = [];
  const built = await buildAboutBlogDraftInput({
    ...base,
    angle: 'Forklar Blank-valget',
    fetchImpl: llmFetch(
      '# Slik virker avstemninger\n\nDu stemmer Ja, Nei eller Blank.\n\n## Blank\n\nBlank teller med.\n\n## Kilder\n\n- ingen',
      prompts,
    ),
  });
  assert.equal(built.ok, true);
  if (built.ok) {
    const { input } = built;
    assert.equal(input.category, 'om-folkets-meninger');
    assert.equal(input.source_event, `about:${REQUEST_ID}`);
    assert.equal(input.slug, 'slik-virker-avstemninger');
    assert.equal(input.title, 'Slik virker avstemninger');
    assert.equal(input.body_md, 'Du stemmer Ja, Nei eller Blank.\n\n## Blank\n\nBlank teller med.');
    assert.ok(input.excerpt.startsWith('Du stemmer Ja, Nei eller Blank.'));
    assert.ok(input.excerpt.length <= BLOG_EXCERPT_MAX);
    assert.equal(input.ai?.prompt_version, ABOUT_BLOG_PROMPT_VERSION);
    assert.equal(input.ai?.model_family, 'answer-llm');
    assert.match(input.review_note ?? '', /Kun utkast/);
    assert.match(input.review_note ?? '', /Vinkling: Forklar Blank-valget/);
    assert.equal(input.sources, undefined);
  }
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /Vinkling fra redaksjonen: Forklar Blank-valget/);

  const repeatedTitle = await buildAboutBlogDraftInput({
    ...base,
    fetchImpl: llmFetch('## slik virker  avstemninger\n\nIngress.\n\n## Blank\n\nBlank teller med.'),
  });
  assert.equal(repeatedTitle.ok, true);
  if (repeatedTitle.ok) {
    assert.equal(repeatedTitle.input.body_md, 'Ingress.\n\n## Blank\n\nBlank teller med.');
  }

  const ownHeading = await buildAboutBlogDraftInput({
    ...base,
    fetchImpl: llmFetch('## Bakgrunn\n\nIngress.'),
  });
  assert.equal(ownHeading.ok, true);
  if (ownHeading.ok) assert.equal(ownHeading.input.body_md, '## Bakgrunn\n\nIngress.');

  const forbidden = await buildAboutBlogDraftInput({
    ...base,
    fetchImpl: llmFetch('Du kan snart logge inn med BankID.'),
  });
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) {
    assert.equal(forbidden.code, 'forbidden_terms');
    assert.match(forbidden.error, /BankID/);
  }

  const onlySources = await buildAboutBlogDraftInput({
    ...base,
    fetchImpl: llmFetch('## Kilder\n\n- ingen'),
  });
  assert.equal(onlySources.ok, false);
  if (!onlySources.ok) assert.equal(onlySources.code, 'empty_body');

  const timeout = await buildAboutBlogDraftInput({
    ...base,
    fetchImpl: (async () => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    }) as typeof fetch,
  });
  assert.equal(timeout.ok, false);
  if (!timeout.ok) assert.equal(timeout.code, 'llm_timeout');

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const httpError = await buildAboutBlogDraftInput({
      ...base,
      fetchImpl: (async () => new Response('nede', { status: 500 })) as typeof fetch,
    });
    assert.equal(httpError.ok, false);
    if (!httpError.ok) assert.equal(httpError.code, 'llm_error');
  } finally {
    console.error = originalConsoleError;
  }
}

void (async () => {
  testForbiddenTerms();
  testProductFacts();
  testPrompt();
  testParseRequest();
  testSlugAndSourceEvent();
  testExcerpt();
  await testBuildDraftInput();
  restoreEnv();
  console.log('lib/blog/about-draft.test.ts ok');
})().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
