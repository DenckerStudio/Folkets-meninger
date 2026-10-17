import { tool } from 'ai';
import { z } from 'zod';
import type { ChatRagClient } from '@/lib/chat/rag';
import { getServiceSupabase } from '@/lib/supabase';
import { getUserStanceCount, getUserStanceHistory } from '@/lib/stances/service';
import { getUserPointsProfile } from '@/lib/user-points-profile';
import { KNOWLEDGE_BADGE_BY_ID } from '@/lib/knowledge/badges';
import { listUserBadges } from '@/lib/knowledge/service';
import { calculateSakImpact } from '@/lib/impact/service';
import { describeProfile, hasAnyImpactParam, parseImpactProfile } from '@/lib/impact/profile';
import type { ImpactProfile, ImpactResult } from '@/lib/impact/types';
import type { ImpactConfidence } from '@/lib/impact/types';
import { userHasPoliticalConsent } from '@/lib/consent/service';
import { getOwnPublicProfilePreview } from '@/lib/public-profile';
import { getOpinionInnspill } from '@/lib/innspill/service';
import {
  getChatViewerSignals,
  listChatNotifications,
  type ChatNotificationItem,
  type ChatStanceSignals,
} from '@/lib/chat/personal';

export type ChatActivityStance = {
  issueId: string;
  title: string | null;
  stance: string;
  updatedAt: string;
};

export type ChatActivityBadge = {
  id: string;
  name: string;
  earnedAt: string | null;
};

export type ChatMyActivity = {
  found: boolean;
  signedIn: boolean;
  points: number;
  tierName: string | null;
  progress: {
    progressLabel: string;
    progressPercent: number;
    nextUnlock: string | null;
    isMaxTier: boolean;
  };
  stanceCount: number;
  recentStances: ChatActivityStance[];
  badges: ChatActivityBadge[];
  /** Topics and labels the user has agreed with (former getMyStanceSignals). */
  stanceSignals: ChatStanceSignals;
  note: string | null;
};

export type ChatImpact = {
  found: boolean;
  issueId: string | null;
  hasProfile: boolean;
  profileLabels: string[];
  result: ImpactResult | null;
  /** Always present when a sak was found. */
  confidence: ImpactConfidence | null;
  /** Where the estimate comes from. Amounts only appear when `amountFromDocuments`. */
  source: ChatImpactSource | null;
  note: string | null;
};

export type ChatImpactSource = {
  kind: 'sak-dokumenter' | 'sammendrag' | 'ingen';
  label: string;
  sourcesUsed: number;
  amountFromDocuments: boolean;
};

/**
 * Keep kroner figures only when they were extracted from real figures in the
 * sak documents (scored document chunks). Otherwise strip every amount so
 * neither the card nor the model can present a guessed number.
 */
export function gateImpactAmounts(result: ImpactResult): {
  result: ImpactResult;
  source: ChatImpactSource;
} {
  const fromDocuments = result.sourcesUsed > 0 && result.grounded;
  const hasAmount =
    result.annualAmountKr != null || result.effects.some((e) => e.annualAmountKr != null);
  const amountFromDocuments = fromDocuments && hasAmount;
  const gated: ImpactResult = amountFromDocuments
    ? result
    : {
        ...result,
        annualAmountKr: null,
        effects: result.effects.map((effect) => ({ ...effect, annualAmountKr: null })),
      };
  const kind: ChatImpactSource['kind'] = fromDocuments
    ? 'sak-dokumenter'
    : result.grounded
      ? 'sammendrag'
      : 'ingen';
  const label =
    kind === 'sak-dokumenter'
      ? `Saksdokumenter (${result.sourcesUsed} utdrag)`
      : kind === 'sammendrag'
        ? 'Sakens sammendrag (ingen tall i dokumentene)'
        : 'Ingen kilde med konkrete tall';
  return {
    result: gated,
    source: { kind, label, sourcesUsed: result.sourcesUsed, amountFromDocuments },
  };
}

export type ChatPublicProfile = {
  found: boolean;
  signedIn: boolean;
  displayName: string | null;
  initials: string | null;
  isStemmePlusSupporter: boolean;
  note: string | null;
};

const EMPTY_PROGRESS = {
  progressLabel: '0',
  progressPercent: 0,
  nextUnlock: null as string | null,
  isMaxTier: false,
};

function serviceRoleAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * The signed-in user's own knowledge points, level, stances and badges. The
 * userId is always derived from the request session, never a tool argument, so
 * the service-role reads below can only ever touch the caller's own rows.
 */
export async function collectMyActivity(
  userId: string | null | undefined,
  limit = 5,
): Promise<ChatMyActivity> {
  if (!userId) {
    return {
      found: false,
      signedIn: false,
      points: 0,
      tierName: null,
      progress: EMPTY_PROGRESS,
      stanceCount: 0,
      recentStances: [],
      badges: [],
      stanceSignals: { categories: [], labels: [] },
      note: 'Du er ikke logget inn, så jeg kan ikke hente aktiviteten din.',
    };
  }

  if (!serviceRoleAvailable()) {
    return {
      found: false,
      signedIn: true,
      points: 0,
      tierName: null,
      progress: EMPTY_PROGRESS,
      stanceCount: 0,
      recentStances: [],
      badges: [],
      stanceSignals: { categories: [], labels: [] },
      note: 'Aktivitetsdata er ikke tilgjengelig akkurat nå.',
    };
  }

  const service = getServiceSupabase();
  const byokActivityAllowed = await userHasPoliticalConsent(service, userId, 'political_byok_activity');
  if (!byokActivityAllowed) {
    return {
      found: false,
      signedIn: true,
      points: 0,
      tierName: null,
      progress: EMPTY_PROGRESS,
      stanceCount: 0,
      recentStances: [],
      badges: [],
      stanceSignals: { categories: [], labels: [] },
      note:
        'Holdningsdata sendes ikke til en ekstern modelleverandør uten eget samtykke. Gi samtykke under Min side → Personvern (BYOK / aktivitet i chat).',
    };
  }
  const safeLimit = Math.min(Math.max(limit, 1), 10);

  const [stanceCount, stanceHistory, pointsProfile, badges, stanceSignals] = await Promise.all([
    getUserStanceCount(service, userId).catch(() => 0),
    getUserStanceHistory(service, userId).catch(() => []),
    getUserPointsProfile(userId, safeLimit).catch(() => null),
    listUserBadges(userId).catch(() => []),
    getChatViewerSignals(userId, service),
  ]);

  const points = pointsProfile?.points ?? 0;
  const progress = pointsProfile?.progress ?? null;

  return {
    found: true,
    signedIn: true,
    points,
    tierName: progress?.tier?.name ?? null,
    progress: {
      progressLabel: progress?.progressLabel ?? EMPTY_PROGRESS.progressLabel,
      progressPercent: progress?.progressPercent ?? EMPTY_PROGRESS.progressPercent,
      nextUnlock: progress?.nextUnlock ?? EMPTY_PROGRESS.nextUnlock,
      isMaxTier: progress?.isMaxTier ?? EMPTY_PROGRESS.isMaxTier,
    },
    stanceCount,
    recentStances: stanceHistory.slice(0, safeLimit).map((item) => ({
      issueId: item.stortinget_issue_id,
      title: item.title ?? null,
      stance: item.stance,
      updatedAt: item.updated_at,
    })),
    badges: badges.slice(0, 12).map((badge) => ({
      id: badge.id,
      name: KNOWLEDGE_BADGE_BY_ID[badge.id]?.name ?? badge.id,
      earnedAt: badge.earnedAt,
    })),
    stanceSignals: {
      categories: stanceSignals.categories.slice(0, 8),
      labels: stanceSignals.labels.slice(0, 8),
    },
    note:
      stanceCount === 0 && badges.length === 0 && points === 0
        ? 'Du har ikke samlet poeng, standpunkt eller merker ennå.'
        : null,
  };
}

export async function collectImpact(args: {
  issueId?: string;
  query?: string;
  resolveIssueId: (input: { issueId?: string; query?: string }) => Promise<string | null>;
  profile: ImpactProfile;
}): Promise<ChatImpact> {
  const hasProfile = hasAnyImpactParam(args.profile);
  const profileLabels = describeProfile(args.profile);

  const id =
    args.issueId?.trim() ||
    (await args.resolveIssueId({ issueId: args.issueId, query: args.query }));
  if (!id) {
    return {
      found: false,
      issueId: null,
      hasProfile,
      profileLabels,
      result: null,
      confidence: null,
      source: null,
      note: 'Fant ingen sak å beregne konsekvens for. Oppgi sak-id eller en tydeligere tittel.',
    };
  }

  const raw = await calculateSakImpact(id, args.profile);
  const { result, source } = gateImpactAmounts(raw);
  const notes = [
    hasProfile
      ? null
      : 'Ingen påvirkningsprofil er satt i nettleseren, så dette er et generelt anslag.',
    source.amountFromDocuments
      ? null
      : 'Saksdokumentene oppgir ingen konkrete beløp, så det vises ikke noe kronebeløp.',
  ].filter(Boolean);
  return {
    found: true,
    issueId: id,
    hasProfile,
    profileLabels,
    result,
    confidence: result.confidence,
    source,
    note: notes.length > 0 ? notes.join(' ') : null,
  };
}

export async function collectPublicProfile(
  client: ChatRagClient | null | undefined,
  userId: string | null | undefined,
): Promise<ChatPublicProfile> {
  if (!userId) {
    return {
      found: false,
      signedIn: false,
      displayName: null,
      initials: null,
      isStemmePlusSupporter: false,
      note: 'Du er ikke logget inn, så jeg har ingen profil å vise.',
    };
  }

  const preview = await getOwnPublicProfilePreview(client, userId);
  return {
    found: true,
    signedIn: true,
    displayName: preview.displayName,
    initials: preview.initials,
    isStemmePlusSupporter: preview.isStemmePlusSupporter,
    note:
      preview.displayName === null
        ? 'Profilen mangler visningsnavn. Fyll ut for- og etternavn under profilen.'
        : null,
  };
}

export type ChatMyNotifications = {
  found: boolean;
  signedIn: boolean;
  items: ChatNotificationItem[];
  note: string | null;
};

export async function collectMyNotifications(
  client: ChatRagClient | null | undefined,
  userId: string | null | undefined,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<ChatMyNotifications> {
  if (!userId) {
    return {
      found: false,
      signedIn: false,
      items: [],
      note: 'Du er ikke logget inn, så jeg kan ikke hente varslene dine.',
    };
  }
  if (!client) {
    return { found: false, signedIn: true, items: [], note: 'Varsler er ikke tilgjengelig akkurat nå.' };
  }
  const items = await listChatNotifications(userId, client, options).catch(() => []);
  return {
    found: items.length > 0,
    signedIn: true,
    items,
    note: items.length === 0 ? 'Ingen varsler å vise.' : null,
  };
}

export type ChatInnspillStatus = {
  found: boolean;
  signedIn: boolean;
  opinionId: string | null;
  status: string | null;
  supportCount: number | null;
  supportThreshold: number | null;
  packagedAt: string | null;
  note: string | null;
};

/**
 * Status for an innspill the signed-in user authored. Only the author's own
 * innspill is returned; anything else is reported as not found.
 */
export async function collectInnspillStatus(
  userId: string | null | undefined,
  opinionId: string,
  load: typeof getOpinionInnspill = getOpinionInnspill,
): Promise<ChatInnspillStatus> {
  const empty = {
    opinionId: opinionId || null,
    status: null,
    supportCount: null,
    supportThreshold: null,
    packagedAt: null,
  };
  if (!userId) {
    return {
      found: false,
      signedIn: false,
      ...empty,
      note: 'Du er ikke logget inn, så jeg kan ikke hente innspillene dine.',
    };
  }
  const innspill = opinionId?.trim() ? await load(opinionId.trim()).catch(() => null) : null;
  if (!innspill || innspill.authorUserId !== userId) {
    return {
      found: false,
      signedIn: true,
      ...empty,
      note: 'Fant ikke noe innspill fra deg for denne meningen. Bare forfatteren kan fremme en mening som innspill, på meningssiden.',
    };
  }
  return {
    found: true,
    signedIn: true,
    opinionId: innspill.opinionId,
    status: innspill.status,
    supportCount: innspill.supportCount,
    supportThreshold: innspill.supportThreshold,
    packagedAt: innspill.packagedAt,
    note: null,
  };
}

export function createPersonalChatTools(args: {
  client?: ChatRagClient | null;
  userId?: string | null;
  impactProfile?: unknown;
  resolveIssueId: (input: { issueId?: string; query?: string }) => Promise<string | null>;
}) {
  const profile = parseImpactProfile(args.impactProfile);

  return {
    getMyActivity: tool({
      description:
        'Hent den innloggede brukerens egen aktivitet: kunnskapspoeng, nivå, antall standpunkter, de nyeste standpunktene og merkene sine. Bruk når brukeren spør hva de har gjort, hvor mange poeng de har eller hvilke merker de har fått.',
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('Hvor mange nyeste standpunkter å vise (1–10, standard 5).'),
      }),
      execute: async ({ limit }) => collectMyActivity(args.userId, limit ?? 5),
    }),
    getImpact: tool({
      description:
        'Beregn hva en sak betyr for den innloggede brukeren ut fra påvirkningsprofilen (fylke, bolig, bil, yrke) som ligger i nettleseren. Bruk når brukeren spør «hva betyr dette for meg» eller «hva koster det for meg». Beløp vises bare når de finnes i kilden.',
      inputSchema: z.object({
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Sak-tittel, henvisning eller spørsmål hvis sak-id ikke er kjent.'),
      }),
      execute: async ({ issueId, query }) =>
        collectImpact({ issueId, query, resolveIssueId: args.resolveIssueId, profile }),
    }),
    getPublicProfile: tool({
      description:
        'Vis den offentlige visningen av den innloggede brukerens egen profil: visningsnavn, initialer og om brukeren er Stemme+-støttespiller. Leser bare egne offentlige felt; kan ikke slå opp andre brukere.',
      inputSchema: z.object({}),
      execute: async () => collectPublicProfile(args.client, args.userId),
    }),
    listMyNotifications: tool({
      description:
        'Hent den innloggede brukerens egne varsler (ny sak i en kategori de følger, merkelapp-treff, innspill-støtte), nyeste først. Bruk når brukeren spør «er det noe nytt for meg» eller «hvilke varsler har jeg». Leser bare egne varsler.',
      inputSchema: z.object({
        unreadOnly: z.boolean().optional().describe('Bare uleste varsler. Standard er alle.'),
        limit: z.number().int().min(1).max(20).optional().describe('Hvor mange varsler (1–20, standard 8).'),
      }),
      execute: async ({ unreadOnly, limit }) =>
        collectMyNotifications(args.client, args.userId, { unreadOnly, limit }),
    }),
    getInnspillStatus: tool({
      description:
        'Sjekk status for et høringsinnspill den innloggede brukeren selv har fremmet i Folkets meninger: samler støtte, terskel nådd eller pakket, og hvor mange som støtter. Bruk når brukeren spør om status på sitt eget innspill. Viser ikke andres innspill.',
      inputSchema: z.object({
        opinionId: z
          .string()
          .min(1)
          .describe('ID-en til brukerens mening (f.eks. fra en lenke til folkets-meninger/<id>).'),
      }),
      execute: async ({ opinionId }) => collectInnspillStatus(args.userId, opinionId),
    }),
  };
}
