import {
  hasStoredCandidateRatings,
  parseCandidateRatings,
} from '@/lib/polls/candidate-ratings';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const live = {
  candidate_ratings: {
    relevance_to_current_social_problems: {
      score: 3,
      reason:
        'Temaet om katastrofeberedskap og oppfølging av berørte er relevant gitt den økende bekymringen for klimaendringer og hyppigere naturhendelser i Norge.',
    },
    date: {
      field: 'detail_json.saksgang.saksgang_steg_liste.saksgang_hendelse_liste.dato',
      value: '2026-06-19',
      within_last_year: true,
      cutoff: '2025-10-03',
    },
    discussed: {
      source: 'searxng',
      query: '',
      empty: true,
      hits: [],
      model_summary: '',
    },
    older_sources: [],
    link_field: 'detail_json.sak_relasjon_liste',
    assessed_at: '2026-10-03T20:20:08.973Z',
  },
};

const ratings = parseCandidateRatings(live);
assert(ratings != null, 'parses stored object');
assert(ratings.relevance?.score === 3, 'relevans score');
assert(ratings.relevance?.reason?.includes('katastrofeberedskap'), 'relevans reason');
assert(ratings.date?.value === '2026-06-19', 'dato');
assert(ratings.date?.withinLastYear === true, 'within last year');
assert(ratings.discussed?.source === 'searxng', 'discussed source');
assert(ratings.discussed?.empty === true, 'empty hits');
assert(ratings.discussed?.hits.length === 0, 'no invented hits');
assert(ratings.assessedAt === '2026-10-03T20:20:08.973Z', 'assessed_at');
assert(hasStoredCandidateRatings(ratings), 'stored ratings present');

assert(parseCandidateRatings({}) == null, 'missing candidate_ratings');
assert(parseCandidateRatings({ candidate_ratings: null }) == null, 'null ratings');
assert(!hasStoredCandidateRatings(null), 'no ratings');

const emptyMeta = parseCandidateRatings({
  candidate_ratings: {
    discussed: { source: 'searxng', hits: [] },
  },
});
assert(emptyMeta?.discussed?.empty === true, 'empty hits are no discussion');

console.log('poll candidate-ratings tests OK');
