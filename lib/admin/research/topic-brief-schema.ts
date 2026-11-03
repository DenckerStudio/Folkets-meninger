import { z } from 'zod';

export const RESEARCH_TOPIC_SOURCE_KINDS = ['cluster', 'reddit'] as const;
export type ResearchTopicSourceKind = (typeof RESEARCH_TOPIC_SOURCE_KINDS)[number];

export type ResearchTopicStatus = 'queued' | 'running' | 'done' | 'failed';

export const RESEARCH_TOPIC_BRIEF_GRADES = ['A', 'B', 'C', 'D'] as const;
export type ResearchTopicBriefGrade = (typeof RESEARCH_TOPIC_BRIEF_GRADES)[number];

export const RESEARCH_TOPIC_BRIEF_GRADE_LEGEND =
  'A: primærkilde · B: troverdig sekundær (meningsmålingsbyråer som Norstat, Opinion, Infact, Kantar og oppdragsgiver navngis) · C: kommentar/aggregat · D: svak/uklar';

export const RESEARCH_TOPIC_SECTION_EMPTY_NOTE = 'ingen funnet';

export const RESEARCH_TOPIC_UNPUBLISHABLE_NOTICE =
  'Trenger minst én kilde utenom Reddit før publisering';

const sectionSchema = z
  .object({
    items: z.array(z.unknown()),
    note: z.string(),
  })
  .passthrough();

export const researchTopicBriefSourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    url: z.string(),
    publisher: z.string().nullable().optional(),
    grade: z.enum(RESEARCH_TOPIC_BRIEF_GRADES),
  })
  .passthrough();

export type ResearchTopicBriefSource = z.infer<typeof researchTopicBriefSourceSchema>;

export const researchTopicBriefOutputSchema = z
  .object({
    topic_title: z.string().optional(),
    current_rules: sectionSchema,
    party_proposals: sectionSchema,
    media_coverage: sectionSchema,
    polls: sectionSchema,
    sources: sectionSchema,
    generated_at: z.string().optional(),
  })
  .passthrough();

export type ResearchTopicBriefOutput = z.infer<typeof researchTopicBriefOutputSchema>;

const UNPUBLISHABLE_HOST_SUFFIXES = ['reddit.com', 'redd.it'] as const;

export function isUnpublishableSourceHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('arctic-shift')) return true;
    return UNPUBLISHABLE_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return true;
  }
}

export function parseTopicBriefSources(section: z.infer<typeof sectionSchema>): ResearchTopicBriefSource[] {
  const parsed: ResearchTopicBriefSource[] = [];
  for (const item of section.items ?? []) {
    const row = researchTopicBriefSourceSchema.safeParse(item);
    if (row.success) parsed.push(row.data);
  }
  return parsed;
}

export function filterPublishableSources(sources: ResearchTopicBriefSource[]): ResearchTopicBriefSource[] {
  return sources.filter((s) => !isUnpublishableSourceHost(s.url));
}

export type ResearchTopicBriefViewModel = {
  output: ResearchTopicBriefOutput;
  displayTitle: string;
  rawAdminTitle: string | null;
  publishable: boolean;
  blockingReason: string | null;
  showUnpublishableNotice: boolean;
  filteredSources: ResearchTopicBriefSource[];
};

export function sectionIsEmpty(section: z.infer<typeof sectionSchema>): boolean {
  if (section.items.length > 0) return false;
  const note = section.note?.trim().toLowerCase() ?? '';
  return note === '' || note === RESEARCH_TOPIC_SECTION_EMPTY_NOTE;
}

export function buildResearchTopicBriefViewModel(input: {
  output: unknown;
  publishable: boolean | null;
  blockingReason: string | null;
  rawTitle: string | null;
  status: ResearchTopicStatus;
  redditSubreddit?: string | null;
}): ResearchTopicBriefViewModel | null {
  if (input.status !== 'done') return null;
  const parsed = researchTopicBriefOutputSchema.safeParse(input.output);
  if (!parsed.success) return null;

  const filteredSources = filterPublishableSources(parseTopicBriefSources(parsed.data.sources));
  const dbPublishable = input.publishable === true;
  const showUnpublishableNotice = !dbPublishable;

  const topicTitle = parsed.data.topic_title?.trim();
  const waitingLabel = input.redditSubreddit
    ? `Reddit-tema (r/${input.redditSubreddit}) – venter på brief`
    : 'Tema – venter på brief';

  const displayTitle = topicTitle || input.rawTitle || waitingLabel;

  return {
    output: parsed.data,
    displayTitle,
    rawAdminTitle: input.rawTitle,
    publishable: dbPublishable,
    blockingReason: input.blockingReason,
    showUnpublishableNotice,
    filteredSources,
  };
}

export function researchTopicRowDisplayTitle(input: {
  status: ResearchTopicStatus;
  rawTitle: string | null;
  output: unknown;
  redditSubreddit?: string | null;
}): string {
  if (input.status === 'done') {
    const parsed = researchTopicBriefOutputSchema.safeParse(input.output);
    const topicTitle = parsed.success ? parsed.data.topic_title?.trim() : null;
    if (topicTitle) return topicTitle;
  }

  const waitingSuffix = input.status === 'done' ? '' : ' – venter på brief';
  if (input.rawTitle) return `${input.rawTitle}${waitingSuffix}`;
  if (input.redditSubreddit) {
    return `Reddit-tema (r/${input.redditSubreddit})${waitingSuffix}`;
  }
  return input.status === 'done' ? 'Tema-brief' : `Tema${waitingSuffix}`;
}

export function researchTopicHasOpenableBrief(status: ResearchTopicStatus): boolean {
  return status === 'done';
}

const RESEARCH_TOPIC_BRIEF_GENERATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Oslo',
};

export function formatResearchTopicBriefGeneratedAt(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return iso;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('nb-NO', RESEARCH_TOPIC_BRIEF_GENERATED_AT_FORMAT).format(date);
}
