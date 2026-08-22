import type { AiSummary } from '@/lib/ai-summary/types';
import { isAiSummaryV2 } from '@/lib/ai-summary/types';
import { hasAnyImpactParam } from './profile';
import {
  audienceLabel,
  profileAudiences,
  retrieveRelevantChunks,
  userSituationPhrase,
} from './retrieve';
import { amountVerb, extractMoneyMentions, formatKr } from './money';
import {
  IMPACT_DISCLAIMER,
  type ImpactAmountKind,
  type ImpactAudience,
  type ImpactChunk,
  type ImpactDirection,
  type ImpactEffect,
  type ImpactProfile,
  type ImpactResult,
  type MoneyMention,
} from './types';

function summaryTexts(summary: AiSummary | null): { who: string | null; how: string | null; narrative: string | null } {
  if (!summary) return { who: null, how: null, narrative: null };
  if (isAiSummaryV2(summary)) {
    return {
      who: summary.who_affected || null,
      how: summary.how_affected || null,
      narrative: summary.narrative || null,
    };
  }
  return {
    who: summary.hvem || null,
    how: summary.kostnad || null,
    narrative: summary.hva || null,
  };
}

function detectAudienceFromText(text: string): ImpactAudience {
  const lower = text.toLowerCase();
  if (/student/.test(lower)) return 'student';
  if (/pensjon/.test(lower)) return 'retired';
  if (/arbeidsledig|dagpenger/.test(lower)) return 'unemployed';
  if (/leietaker|leieboer|husleie/.test(lower)) return 'renter';
  if (/boligeier|eiendomsskatt|huseier/.test(lower)) return 'homeowner';
  if (/\bbil\b|kjøretøy|elbil|bompenger|veibruks/.test(lower)) return 'car_owner';
  if (/yrkesaktiv|arbeidstaker|lønnstaker/.test(lower)) return 'employed';
  return 'general';
}

function mentionToEffect(
  mention: MoneyMention,
  index: number,
  userAudiences: Set<ImpactAudience>,
  profile: ImpactProfile,
): ImpactEffect {
  const audience = detectAudienceFromText(mention.excerpt);
  const appliesToUser =
    audience === 'general' || userAudiences.has(audience) || (audience === 'car_owner' && profile.hasCar === 'yes');

  return {
    id: `money-${index}`,
    title: audienceLabel(audience, profile),
    summary:
      mention.direction === 'unknown'
        ? `Kilden omtaler ${formatKr(mention.amountKr)} knyttet til denne gruppen.`
        : `Kilden peker på ${formatKr(mention.amountKr)} ${amountVerb(mention.direction, mention.kind)} i året.`,
    appliesToUser,
    audience,
    audienceLabel: audienceLabel(audience, profile),
    direction: mention.direction,
    annualAmountKr: mention.amountKr,
    amountKind: mention.kind,
    evidence: mention.excerpt,
  };
}

function qualitativeEffects(
  summary: { who: string | null; how: string | null },
  profile: ImpactProfile,
  userAudiences: Set<ImpactAudience>,
): ImpactEffect[] {
  const effects: ImpactEffect[] = [];
  if (summary.who) {
    const audience = detectAudienceFromText(summary.who);
    effects.push({
      id: 'who',
      title: 'Hvem saken treffer',
      summary: summary.who,
      appliesToUser: audience === 'general' || userAudiences.has(audience),
      audience,
      audienceLabel: audienceLabel(audience, profile),
      direction: 'unknown',
      annualAmountKr: null,
      amountKind: null,
      evidence: summary.who,
    });
  }
  if (summary.how) {
    const audience = detectAudienceFromText(summary.how);
    const mentions = extractMoneyMentions(summary.how);
    effects.push({
      id: 'how',
      title: 'Hvordan de berøres',
      summary: summary.how,
      appliesToUser: audience === 'general' || userAudiences.has(audience),
      audience,
      audienceLabel: audienceLabel(audience, profile),
      direction: mentions[0]?.direction ?? 'unknown',
      annualAmountKr: mentions[0]?.amountKr ?? null,
      amountKind: mentions[0]?.kind ?? null,
      evidence: summary.how,
    });
  }
  return effects;
}

function mergeDirection(effects: ImpactEffect[]): ImpactDirection {
  const dirs = new Set(effects.filter((e) => e.appliesToUser).map((e) => e.direction));
  dirs.delete('unknown');
  dirs.delete('none');
  if (dirs.size === 0) return effects.some((e) => e.annualAmountKr) ? 'unknown' : 'none';
  if (dirs.size > 1) return 'mixed';
  const only = [...dirs][0];
  return only;
}

function personalAmount(effects: ImpactEffect[], direction: ImpactDirection): {
  amount: number | null;
  kind: ImpactAmountKind | null;
} {
  const relevant = effects.filter(
    (e) => e.appliesToUser && e.annualAmountKr != null && (e.direction === direction || direction === 'unknown'),
  );
  if (relevant.length === 0 || direction === 'mixed' || direction === 'none') {
    return { amount: null, kind: relevant[0]?.amountKind ?? null };
  }
  const first = relevant[0];
  return { amount: first.annualAmountKr, kind: first.amountKind };
}

function confidenceFor(result: {
  amount: number | null;
  matchingEffects: number;
  sourcesUsed: number;
  hasSummary: boolean;
}): ImpactResult['confidence'] {
  if (result.amount != null && result.matchingEffects > 0 && result.sourcesUsed > 0) return 'high';
  if (result.hasSummary && (result.matchingEffects > 0 || result.sourcesUsed > 0)) return 'medium';
  return 'low';
}

function buildHeadline(args: {
  profile: ImpactProfile;
  direction: ImpactDirection;
  amount: number | null;
  kind: ImpactAmountKind | null;
  who: string | null;
}): string {
  const you = userSituationPhrase(args.profile);
  if (args.amount != null && (args.direction === 'increase' || args.direction === 'decrease')) {
    return `Dette forslaget vil gi ${you} anslått ${formatKr(args.amount)} ${amountVerb(args.direction, args.kind)} i året.`;
  }
  if (args.direction === 'mixed') {
    return `Som ${you} kan saken både gi og ta — dokumentene peker på flere motstridende økonomiske virkninger.`;
  }
  if (args.direction === 'none') {
    return `Ut fra dokumentene ser vi ingen konkret personlig pengeeffekt for ${you}.`;
  }
  if (args.who) {
    return `Som ${you} kan saken påvirke deg, men kilden oppgir ikke et konkret beløp for din situasjon.`;
  }
  return 'Vi fant ikke nok i dokumentene til å beregne en personlig kroneeffekt ennå.';
}

export function synthesizeImpact(args: {
  profile: ImpactProfile;
  chunks: ImpactChunk[];
  summary: AiSummary | null;
  title?: string | null;
}): ImpactResult {
  const texts = summaryTexts(args.summary);
  const relevant = retrieveRelevantChunks(args.chunks, args.profile, 8);
  const corpus = [
    texts.how,
    texts.who,
    texts.narrative,
    ...relevant.map((c) => c.content),
  ]
    .filter(Boolean)
    .join('\n\n');

  const userAudiences = new Set(profileAudiences(args.profile));
  const moneyEffects = extractMoneyMentions(corpus).map((mention, index) =>
    mentionToEffect(mention, index, userAudiences, args.profile),
  );
  const quality = qualitativeEffects(texts, args.profile, userAudiences);

  const seenTitles = new Set<string>();
  const effects: ImpactEffect[] = [];
  for (const effect of [...moneyEffects, ...quality]) {
    const key = `${effect.audience}:${effect.annualAmountKr ?? effect.summary.slice(0, 40)}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    effects.push(effect);
    if (effects.length >= 6) break;
  }

  const matching = effects.filter((e) => e.appliesToUser);
  const direction = mergeDirection(effects);
  const { amount, kind } = personalAmount(effects, direction);
  const personalized = hasAnyImpactParam(args.profile);
  const headline = personalized
    ? buildHeadline({
        profile: args.profile,
        direction,
        amount,
        kind,
        who: texts.who,
      })
    : texts.who
      ? 'Velg noen anonyme opplysninger for å se hvordan saken kan treffe deg.'
      : 'Velg fylke, bolig, bil og livssituasjon for å beregne den personlige effekten.';

  const personalSummary = personalized
    ? matching[0]?.summary ??
      texts.how ??
      'Dokumentene beskriver saken, men kobler den ikke tydelig til din situasjon.'
    : texts.how ??
      'Kalkulatoren bruker saksdokumentene og AI-sammendraget til å anslå effekten for deg.';

  const sourcesUsed = relevant.filter((c) => (c.score ?? 0) > 0).length;
  const grounded = amount != null || Boolean(texts.who || texts.how);

  return {
    headline,
    personalSummary,
    annualAmountKr: personalized ? amount : null,
    direction,
    amountKind: kind,
    confidence: confidenceFor({
      amount,
      matchingEffects: matching.length,
      sourcesUsed,
      hasSummary: Boolean(texts.who || texts.how),
    }),
    effects,
    grounded,
    sourcesUsed,
    whoAffected: texts.who,
    howAffected: texts.how,
    disclaimer: IMPACT_DISCLAIMER,
  };
}
