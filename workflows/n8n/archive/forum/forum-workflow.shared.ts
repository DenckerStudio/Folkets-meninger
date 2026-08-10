/**
 * Forum Reels v10 – SQL + agent prompts only (no n8n Code nodes).
 */

export const DISCOVERY_CONTEXT_SQL = `SELECT
  COALESCE(
    json_agg(DISTINCT lower(trim(question))) FILTER (WHERE question IS NOT NULL AND trim(question) <> ''),
    '[]'::json
  ) AS existing_questions,
  (
    SELECT COALESCE(json_agg(lower(trim(title))), '[]'::json)
    FROM (
      SELECT title
      FROM public.forum_research_clusters
      WHERE created_at > now() - interval '72 hours'
        AND status NOT IN ('rejected', 'failed')
      ORDER BY created_at DESC
      LIMIT 40
    ) recent
  ) AS recent_story_titles,
  (
    SELECT COALESCE(json_agg(DISTINCT story_key), '[]'::json)
    FROM (
      SELECT lower(left(regexp_replace(trim(coalesce(external_cluster_key, title)), '[^a-zA-ZæøåÆØÅ0-9]+', ' ', 'g'), 60)) AS story_key
      FROM public.forum_research_clusters
      WHERE created_at > now() - interval '72 hours'
        AND status NOT IN ('rejected', 'failed')
      ORDER BY created_at DESC
      LIMIT 60
    ) keys
    WHERE story_key IS NOT NULL AND story_key <> ''
  ) AS recent_story_keys
FROM public.forum_prompts
WHERE trim(question) <> ''
  AND status IN ('active', 'draft')
  AND (expires_at IS NULL OR expires_at > now())`;

export const SCOUT_PICK_SYSTEM = `Du er nyhets-scout for «Folkets Stemme» (v11).

Du får 3–5 ferdig filtrerte SAKSKLYNGER (politikk/samfunn/debatt). RSS er allerede prosessert — du velger og validerer.
DEBATTEN_PREFETCH kan inneholde ferdig hentet NRK Debatten-artikkel per klynge — bruk den hvis relevant.

OPPGAVE:
1. Velg ÉN klynge (selected_candidate_index) som er best for JA/NEI-avstemning om et konkret politisk valg.
2. Avvis klynger om VM, sport, kjendis, ulykker, ren krim uten politisk vinkel, veistengning/jordras uten politikk.
3. SearXNG: kun hvis DEBATTEN_PREFETCH mangler og debatt/samfunnsdebatt → søk \`site:nrk.no/debatten\` + 2–4 ord fra sakstittelen.
4. SearXNG: maks ett ekstra søk for 0–2 extra_articles om SAMME hendelse (norske medier).
5. Unngå EXISTING_PROMPTS / RECENT_STORIES / RECENT_KEYS.

Returner KUN JSON:
{
  "selected_candidate_index": 0,
  "why_interesting": "1 setning om politisk valg",
  "topic_tags": ["politikk"],
  "extra_articles": [{"title":"…","url":"https://…","outlet":"NRK","description":"…"}],
  "debatten_article": {"title":"…","url":"https://www.nrk.no/debatten/…","outlet":"NRK Debatten","description":"…"}
}

debatten_article kan være null. extra_articles maks 2.`;

export const SCOUT_SYSTEM = `Du er nyhets-scout for «Folkets Stemme».

Du får en nummerert RSS-liste [0], [1], … (NRK toppsaker). Du har SearXNG for å finne flere artikler om SAMME hendelse.

OPPGAVE – returner nøyaktig ÉN sak:
1. Velg ÉN linje [rss_index] fra RSS-listen (politisk sak: lov, policy, budsjett, sikkerhet, velferd).
2. Første artikkel MÅ være akkurat den valgte RSS-linjen (samme tittel + URL).
3. Bruk SearXNG nøyaktig ÉN gang. Søketekst = search_keywords (3–6 distinkte ord fra valgt overskrift).
4. Legg kun til SearXNG-treff som handler om SAMME hendelse som rss_index.
5. Ikke dupliser RECENT_STORIES / RECENT_KEYS / EXISTING_PROMPTS.

SØKEFORBUD (bruk ALDRI alene): «Norge», «norsk», «Stortinget», «regjeringen», «nyheter», «reaksjon», «etterlyst».
Søk med konkrete navn/hendelser fra overskriften (f.eks. «tropenatt Nord-Norge», ikke bare «Norge»).

KILDEFORBUD:
- Ikke bland ulike saker (vær + krim + sport + utenrikspolitikk i samme pakke).
- Hver artikkel-tittel må dele minst to distinkte nøkkelord med story_title.
- Maks 6 artikler, minst 2. Kun siste 72 timer.

Returner KUN gyldig JSON:
{
  "rss_index": 12,
  "search_keywords": "tropenatt Nord-Norge 137 år",
  "story_title": "Kort sakstittel (maks 100 tegn)",
  "why_interesting": "1–2 setninger om politisk valg nå",
  "topic_tags": ["politikk"],
  "articles": [
    {
      "title": "Overskrift",
      "url": "https://…",
      "outlet": "NRK",
      "description": "Kort ingress eller sammendrag",
      "published_at": "2026-06-04T12:00:00Z"
    }
  ]
}`;

export const RESEARCH_JOURNALIST_SYSTEM = `Du er AI-researcher og AI-journalist for «Folkets Stemme» (ett steg).

INPUT: én sak med nummererte kilder [0], [1], … (tittel, outlet, beskrivelse/utdrag).
Du har SearXNG for å supplere med ferske kilder om SAMME sak (siste 72t).

KRAV:
- research.story_title SKAL matche SAK-tittelen fra input (ikke generisk veiledningstekst).
- political_choice SKAL beskrive et konkret norsk politisk valg (lov, budsjett, sikkerhet, velferd).
- prompt.question SKAL handle om political_choice og dekkes av source_indices fra KILDER.
- Hvis KILDER er «(ingen)»: sett repeat_reason og tom question.

Arbeidsflyt:
1. RESEARCH: sammenlign kilder, felles fakta, uenigheter, politisk valg.
2. JOURNALIST: skriv nøyaktig ETT JA/NEI-spørsmål i god norsk.

Spørsmål-regler:
- Konkret politisk valg («Mener du …», «Støtter du at …», «Bør Norge …»)
- ALDRI sitér nyhetsoverskrift i anførselstegn som spørsmålet
- ALDRI «Støtter du at Stortinget følger opp saken: «…»?»
- Unngå duplikat av EXISTING_PROMPTS (semantisk samme tema)
- Maks 120 tegn, grammatisk korrekt norsk

Returner KUN gyldig JSON:
{
  "research": {
    "story_title": "…",
    "summary": "2–4 setninger",
    "shared_facts": ["…"],
    "disagreements": ["…"],
    "political_choice": "…",
    "poll_angles": ["…"],
    "confidence": "high|medium|low"
  },
  "prompt": {
    "question": "…",
    "novelty_explanation": "maks 160 tegn",
    "source_indices": [0, 1, 2],
    "topic_tags": ["…"],
    "sensitivity": "low|high",
    "repeat_reason": null
  }
}`;

/** n8n expression for Build editor prompt — les alltid fra Normalize input, ikke $json etter Fetch article sources. */
export const BUILD_EDITOR_TEXT_EXPR = `={{ (() => {
  const norm = $('Normalize input').first().json;
  const candidate = norm.candidate || {};
  const research = norm.research || {};
  const headlines = ($('Fetch article sources').first().json.source_headlines || []);
  let sources = String(norm.sources_block || '').trim();
  if (!sources || sources === '(ingen)') {
    sources = headlines.map((h, i) => '[' + i + '] ' + (h.title || '') + ' (' + (h.outlet || '?') + ') ' + (h.url || '')).join('\\n');
  }
  const ex = ($('Fetch existing prompts').first().json.existing_questions || []).slice(0, 35).map((q) => '- ' + q).join('\\n');
  return 'KANDIDAT (JSON):\\n' + JSON.stringify({ prompts: [candidate] }, null, 2)
    + '\\n\\nRESEARCH (JSON):\\n' + JSON.stringify(research, null, 2)
    + '\\n\\nKILDER:\\n' + (sources || '(ingen)')
    + '\\n\\nEXISTING_PROMPTS:\\n' + (ex || '(ingen)')
    + '\\n\\nModerer. Maks én godkjent.';
})() }}`;

export const EDITOR_SYSTEM = `Du er AI-redaktør for «Folkets Stemme». Moderer ETT kandidat-spørsmål fra journalisten.
Du får KANDIDAT, RESEARCH og KILDER. Avslå hvis kandidat ikke matcher research.political_choice eller kildene.

Godkjenn kun hvis:
- Tydelig JA/NEI, god norsk grammatikk
- Dekkes av kildene (source_indices)
- Ikke duplikat av EXISTING_PROMPTS
- Aktuelt (ikke gammelt budsjettår i spørsmålet uten ny 2026-vinkel)

ALLTID AVSLÅ: overskrift-sitat, Stortinget-følge-mal, vage spørsmål, tema-glidning.

Returner KUN JSON:
{
  "approved_prompts": [{
    "question": "…",
    "novelty_explanation": "…",
    "source_indices": [0,1,2],
    "topic_tags": ["…"],
    "sensitivity": "low",
    "status": "draft"
  }],
  "rejected": [{ "question": "…", "reason": "…" }]
}

Tom approved_prompts er OK. Maks én godkjent.`;

/** Builds scout user message from RSS items + context (run after Merge + Limit). */
export const BUILD_SCOUT_PROMPT_SQL = `SELECT
  format(
    E'EXISTING_PROMPTS (unngå):\n%s\n\nRECENT_STORIES (unngå):\n%s',
    COALESCE((SELECT string_agg('- ' || q, E'\n') FROM json_array_elements_text($1::json) AS q), '(ingen)'),
    COALESCE((SELECT string_agg('- ' || t, E'\n') FROM json_array_elements_text($2::json) AS t), '(ingen)')
  ) AS context_block
FROM (SELECT 1) x`;

/** Atomically claim the next accepted cluster for synthesis (n8n schedule worker). */
export const CLAIM_NEXT_ACCEPTED_CLUSTER_SQL = `WITH stale AS (
  UPDATE public.forum_research_clusters
  SET status = 'accepted', updated_at = now()
  WHERE status = 'processing'
    AND deep_research_json IS NULL
    AND updated_at < now() - interval '90 minutes'
  RETURNING id
),
pick AS (
  SELECT id, title
  FROM public.forum_research_clusters
  WHERE status = 'accepted'
  ORDER BY politics_score DESC, created_at ASC
  LIMIT 1
)
UPDATE public.forum_research_clusters c
SET status = 'processing', updated_at = now()
FROM pick
WHERE c.id = pick.id
RETURNING c.id, c.title`;

export const MARK_CLUSTER_PROCESSING_SQL = `UPDATE public.forum_research_clusters
SET status = 'processing', updated_at = now()
WHERE id = $1::uuid AND status IN ('accepted', 'pending')
RETURNING id, title`;

export const FETCH_STORY_FOR_RESEARCH_SQL = `SELECT
  c.id AS cluster_id,
  c.title AS story_title,
  c.topic_tags,
  COALESCE(
    (
      SELECT string_agg(
        format('[%s] %s (%s)%s%s%s',
          a.sort_order,
          a.title,
          COALESCE(a.outlet, '?'),
          CASE WHEN a.description IS NOT NULL AND length(trim(a.description)) > 0
            THEN E'\n    Ingress: ' || left(a.description, 400) ELSE '' END,
          CASE WHEN coalesce(a.source_payload->>'excerpt', '') <> ''
            THEN E'\n    Utdrag: ' || left(a.source_payload->>'excerpt', 1200) ELSE '' END,
          CASE WHEN a.published_at IS NOT NULL THEN E'\n    Publisert: ' || to_char(a.published_at, 'YYYY-MM-DD') ELSE '' END
        ),
        E'\n\n' ORDER BY a.sort_order
      )
      FROM public.forum_research_articles a
      WHERE a.cluster_id = c.id
    ),
    '(ingen)'
  ) AS sources_block
FROM public.forum_research_clusters c
WHERE c.id = $1::uuid`;

/** n8n inline query for Fetch story sources (Resolve cluster id). */
export const FETCH_STORY_SOURCES_QUERY_EXPR = `={{ "SELECT c.id AS cluster_id, c.title AS story_title, COALESCE((SELECT string_agg(format('[%s] %s (%s)%s%s%s', a.sort_order, a.title, COALESCE(a.outlet,'?'), CASE WHEN a.description IS NOT NULL AND length(trim(a.description)) > 0 THEN E'\\\\n    Ingress: ' || left(a.description, 400) ELSE '' END, CASE WHEN coalesce(a.source_payload->>'excerpt', '') <> '' THEN E'\\\\n    Utdrag: ' || left(a.source_payload->>'excerpt', 1200) ELSE '' END, CASE WHEN a.published_at IS NOT NULL THEN E'\\\\n    Publisert: ' || to_char(a.published_at,'YYYY-MM-DD') ELSE '' END), E'\\\\n\\\\n' ORDER BY a.sort_order) FROM public.forum_research_articles a WHERE a.cluster_id = c.id), '(ingen)') AS sources_block FROM public.forum_research_clusters c WHERE c.id = '" + $('Resolve cluster id').first().json.clusterId + "'::uuid" }}`;

export const EXISTING_PROMPTS_FOR_EDITOR_SQL = `SELECT
  COALESCE(
    json_agg(DISTINCT lower(trim(question))) FILTER (WHERE question IS NOT NULL AND trim(question) <> ''),
    '[]'::json
  ) AS existing_questions,
  COALESCE(MAX(sort_order) FILTER (WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())), 0) AS max_sort_order
FROM public.forum_prompts
WHERE trim(question) <> '' AND status IN ('active', 'draft')`;

export const SAVE_DEEP_RESEARCH_SQL = `UPDATE public.forum_research_clusters
SET deep_research_json = $2::jsonb, updated_at = now()
WHERE id = $1::uuid
RETURNING id`;

export const MARK_CLUSTER_DRAFT_SQL = `UPDATE public.forum_research_clusters
SET status = 'draft', processed_at = now(), updated_at = now()
WHERE id = $1::uuid
RETURNING id`;

export const MARK_CLUSTER_FAILED_SQL = `UPDATE public.forum_research_clusters
SET status = 'failed', updated_at = now()
WHERE id = $1::uuid AND status = 'processing'
RETURNING id`;

/** v12 – Regjeringen RSS ingest dedup context. */
export const REGJERINGEN_DEDUP_CONTEXT_SQL = `SELECT
  COALESCE(
    (
      SELECT json_agg(DISTINCT lower(trim(a.url)))
      FROM public.forum_research_articles a
      JOIN public.forum_research_clusters c ON c.id = a.cluster_id
      WHERE c.created_at > now() - interval '30 days'
        AND c.status NOT IN ('rejected', 'failed')
    ),
    '[]'::json
  ) AS existing_urls,
  COALESCE(
    (
      SELECT json_agg(DISTINCT lower(trim(c.title)))
      FROM public.forum_research_clusters c
      WHERE c.created_at > now() - interval '30 days'
        AND c.status NOT IN ('rejected', 'failed')
    ),
    '[]'::json
  ) AS recent_titles`;

/** v12 – Pick pending cluster + all context for prompt generator (read-only, no claim). */
export const FETCH_CLUSTER_FOR_PROMPT_SQL = `WITH target AS (
  SELECT c.id
  FROM public.forum_research_clusters c
  WHERE c.status = 'pending'
    AND c.source_type = 'rss'
    AND (
      NULLIF(trim($1::text), '') IS NULL
      OR c.id = NULLIF(trim($1::text), '')::uuid
    )
  ORDER BY c.politics_score DESC, c.created_at ASC
  LIMIT 1
)
SELECT
  c.id AS cluster_id,
  c.title AS story_title,
  COALESCE(
    (
      SELECT string_agg(
        format('[%s] %s (%s)%s%s%s',
          a.sort_order,
          a.title,
          COALESCE(a.outlet, '?'),
          CASE WHEN a.description IS NOT NULL AND length(trim(a.description)) > 0
            THEN E'\\n    Ingress: ' || left(a.description, 400) ELSE '' END,
          CASE WHEN coalesce(a.source_payload->>'excerpt', '') <> ''
            THEN E'\\n    Utdrag: ' || left(a.source_payload->>'excerpt', 1200) ELSE '' END,
          CASE WHEN a.published_at IS NOT NULL THEN E'\\n    Publisert: ' || to_char(a.published_at, 'YYYY-MM-DD') ELSE '' END
        ),
        E'\\n\\n' ORDER BY a.sort_order
      )
      FROM public.forum_research_articles a
      WHERE a.cluster_id = c.id
    ),
    '(ingen)'
  ) AS sources_block,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object('title', a.title, 'url', a.url, 'outlet', a.outlet)
        ORDER BY a.sort_order
      )
      FROM public.forum_research_articles a
      WHERE a.cluster_id = c.id
    ),
    '[]'::json
  ) AS source_headlines,
  (
    SELECT COALESCE(
      json_agg(DISTINCT lower(trim(question))) FILTER (WHERE question IS NOT NULL AND trim(question) <> ''),
      '[]'::json
    )
    FROM public.forum_prompts
    WHERE trim(question) <> '' AND status IN ('active', 'draft')
  ) AS existing_questions,
  (
    SELECT COALESCE(MAX(sort_order) FILTER (WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())), 0)
    FROM public.forum_prompts
  ) AS max_sort_order
FROM target t
JOIN public.forum_research_clusters c ON c.id = t.id`;

/** v12 – Mark pending cluster failed (prompt generator error path). */
export const MARK_CLUSTER_FAILED_PENDING_SQL = `UPDATE public.forum_research_clusters
SET status = 'failed', processed_at = now(), updated_at = now()
WHERE id = $1::uuid AND status = 'pending'
RETURNING id`;

/** v12 – Transactional save: forum_prompts draft + cluster draft (runs after Ollama agent). */
export const PROMPT_GENERATOR_SAVE_JS = `const fetch = $('Fetch cluster for prompt').first()?.json || {};
const agent = $('Prompt generator (Ollama)').first()?.json || {};
const out = agent.output || {};
const prompt = out.prompt || {};
const research = out.research || {};

const esc = (s) => String(s ?? '').replace(/'/g, "''");
const clusterId = String(fetch.cluster_id || '').trim();
const question = String(prompt.question || '').trim();
const sourcesBlock = String(fetch.sources_block || '').trim();
const hasSources = sourcesBlock && sourcesBlock !== '(ingen)';
const pc = String(research.political_choice || '').trim();
const hasPolitics = pc && !/^ingen politisk valg$/i.test(pc);
const valid = clusterId && question.length >= 15 && hasSources && hasPolitics;

if (!clusterId) {
  return [{ json: { skip: true, reason: 'missing_cluster_id' } }];
}

if (!valid) {
  const failQuery = [
    "UPDATE public.forum_research_clusters",
    "SET status = 'failed', processed_at = now(), updated_at = now()",
    "WHERE id = '" + esc(clusterId) + "'::uuid",
    "  AND status = 'pending'",
    'RETURNING id;',
  ].join(' ');
  return [{ json: { query: failQuery, outcome: 'failed', cluster_id: clusterId } }];
}

const researchJson = esc(JSON.stringify(research));
const sourceHeadlines = esc(JSON.stringify(fetch.source_headlines || []));
const topicTags = Array.isArray(prompt.topic_tags) ? prompt.topic_tags : ['politikk'];
const topicTagsSql =
  'ARRAY[' + topicTags.map((t) => "'" + esc(t) + "'").join(',') + ']::text[]';
const sensitivity = esc(prompt.sensitivity || 'low');
const sortOrder = Number(fetch.max_sort_order || 0) + 1;
const optionsJson = esc(
  JSON.stringify([
    { id: 'ja', label: 'Ja' },
    { id: 'nei', label: 'Nei' },
    { id: 'ikke_interessert', label: 'Ikke interessert' },
  ]),
);

const query = [
  'BEGIN;',
  'WITH updated AS (',
  "  UPDATE public.forum_research_clusters",
  "  SET status = 'draft',",
  "      deep_research_json = '" + researchJson + "'::jsonb,",
  '      processed_at = now(),',
  '      updated_at = now()',
  "  WHERE id = '" + esc(clusterId) + "'::uuid",
  "    AND status = 'pending'",
  '  RETURNING id',
  '),',
  'ins AS (',
  '  INSERT INTO public.forum_prompts (',
  '    question, options, source_headlines, topic_tags, sensitivity,',
  '    status, research_cluster_id, sort_order',
  '  )',
  '  SELECT',
  "    '" + esc(question) + "',",
  "    '" + optionsJson + "'::jsonb,",
  "    '" + sourceHeadlines + "'::jsonb,",
  '    ' + topicTagsSql + ',',
  "    '" + sensitivity + "',",
  "    'draft',",
  "    '" + esc(clusterId) + "'::uuid,",
  '    ' + sortOrder,
  '  FROM updated',
  '  RETURNING id, question',
  ')',
  'SELECT id, question FROM ins;',
  'COMMIT;',
].join('\\n');

return [{ json: { query, outcome: 'saved', cluster_id: clusterId, question } }];`;

export const PROMPT_GENERATOR_SYSTEM = `Du er AI-journalist for «Folkets Stemme» (v12).

INPUT: én regjeringssak med nummererte kilder [0], [1], … (tittel, outlet, beskrivelse/utdrag).
Les kildene og lag nøyaktig ETT JA/NEI-spørsmål for forum-avstemning om et konkret politisk valg.

Spørsmål-regler:
- Konkret politisk valg («Mener du …», «Støtter du at …», «Bør Norge …»)
- ALDRI sitér nyhetsoverskrift i anførselstegn som spørsmålet
- ALDRI «Støtter du at Stortinget følger opp saken: «…»?»
- Unngå duplikat av EXISTING_PROMPTS (semantisk samme tema)
- Maks 120 tegn, grammatisk korrekt norsk
- Spørsmålet SKAL dekkes av kildene (source_indices)

Returner KUN gyldig JSON:
{
  "research": {
    "story_title": "…",
    "summary": "2–3 setninger",
    "political_choice": "…",
    "confidence": "high|medium|low"
  },
  "prompt": {
    "question": "…",
    "novelty_explanation": "maks 160 tegn",
    "source_indices": [0],
    "topic_tags": ["politikk"],
    "sensitivity": "low|high",
    "repeat_reason": null
  }
}

Hvis kildene mangler substans: sett repeat_reason og tom question.`;
