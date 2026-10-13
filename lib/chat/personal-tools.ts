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
import { getOwnPublicProfilePreview } from '@/lib/public-profile';

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
  note: string | null;
};

export type ChatImpact = {
  found: boolean;
  issueId: string | null;
  hasProfile: boolean;
  profileLabels: string[];
  result: ImpactResult | null;
  note: string | null;
};

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
      note: 'Aktivitetsdata er ikke tilgjengelig akkurat nå.',
    };
  }

  const service = getServiceSupabase();
  const safeLimit = Math.min(Math.max(limit, 1), 10);

  const [stanceCount, stanceHistory, pointsProfile, badges] = await Promise.all([
    getUserStanceCount(service, userId).catch(() => 0),
    getUserStanceHistory(service, userId).catch(() => []),
    getUserPointsProfile(userId, safeLimit).catch(() => null),
    listUserBadges(userId).catch(() => []),
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
      note: 'Fant ingen sak å beregne konsekvens for. Oppgi sak-id eller en tydeligere tittel.',
    };
  }

  const result = await calculateSakImpact(id, args.profile);
  return {
    found: true,
    issueId: id,
    hasProfile,
    profileLabels,
    result,
    note: hasProfile
      ? null
      : 'Ingen påvirkningsprofil er satt i nettleseren, så dette er et generelt anslag.',
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
  };
}
