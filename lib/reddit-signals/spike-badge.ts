import { isValidRedditId } from '@/lib/reddit-signals/url';
import { routes } from '@/lib/routes';

export const REDDIT_SPIKE_BADGE_CONFIG_KEY = 'spike_badge';

export type SpikeBadgeItemKind = 'post' | 'cluster';

export type SpikeBadgeItemRef = {
  kind: SpikeBadgeItemKind;
  redditId?: string;
  signalId?: string;
  clusterId?: string;
  label: string;
};

export type RedditSpikeBadgeView = {
  items: SpikeBadgeItemRef[];
};

export type SpikeBadgeFocus = {
  kind: SpikeBadgeItemKind;
  redditId?: string;
  signalId?: string;
  clusterId?: string;
};

export function parseSpikeBadgeConfigValue(value: unknown): RedditSpikeBadgeView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.active !== true) return null;

  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw)) return null;

  const items: SpikeBadgeItemRef[] = [];
  for (const entry of itemsRaw) {
    const parsed = parseSpikeBadgeItem(entry);
    if (parsed) items.push(parsed);
  }

  return { items };
}

function parseSpikeBadgeItem(entry: unknown): SpikeBadgeItemRef | null {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    if (isValidRedditId(trimmed)) {
      return { kind: 'post', redditId: trimmed, label: `Innlegg ${trimmed}` };
    }
    return { kind: 'cluster', clusterId: trimmed, label: `Klynge ${trimmed}` };
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const o = entry as Record<string, unknown>;

  const kindRaw = o.kind ?? o.type;
  const redditId = readNonEmptyString(o.reddit_id ?? o.redditId);
  const signalId = readNonEmptyString(o.signal_id ?? o.signalId ?? o.id);
  const clusterId = readNonEmptyString(o.cluster_id ?? o.clusterId);
  const label = readNonEmptyString(o.label ?? o.title);

  let kind: SpikeBadgeItemKind | null = null;
  if (kindRaw === 'post' || kindRaw === 'innlegg') kind = 'post';
  if (kindRaw === 'cluster' || kindRaw === 'klynge') kind = 'cluster';

  if (!kind) {
    if (redditId && isValidRedditId(redditId)) kind = 'post';
    else if (signalId) kind = 'post';
    else if (clusterId) kind = 'cluster';
  }

  if (kind === 'post') {
    if (redditId && !isValidRedditId(redditId)) return null;
    if (!redditId && !signalId) return null;
    return {
      kind: 'post',
      redditId: redditId ?? undefined,
      signalId: signalId ?? undefined,
      label: label ?? (redditId ? `Innlegg ${redditId}` : 'Markert innlegg'),
    };
  }

  if (kind === 'cluster') {
    if (!clusterId) return null;
    return {
      kind: 'cluster',
      clusterId,
      label: label ?? `Klynge ${clusterId}`,
    };
  }

  return null;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function spikeFocusToQueryParam(focus: SpikeBadgeFocus): string {
  if (focus.kind === 'cluster' && focus.clusterId) {
    return `cluster:${focus.clusterId}`;
  }
  if (focus.signalId) return `signal:${focus.signalId}`;
  if (focus.redditId) return `post:${focus.redditId}`;
  return '';
}

export function parseSpikeFocusParam(raw: string): SpikeBadgeFocus | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const sep = trimmed.indexOf(':');
  if (sep <= 0) return null;
  const prefix = trimmed.slice(0, sep);
  const id = trimmed.slice(sep + 1).trim();
  if (!id) return null;

  if (prefix === 'cluster') return { kind: 'cluster', clusterId: id };
  if (prefix === 'post' && isValidRedditId(id)) return { kind: 'post', redditId: id };
  if (prefix === 'signal') return { kind: 'post', signalId: id };
  return null;
}

export function buildSpikeItemAdminHref(item: SpikeBadgeItemRef): string {
  const focus: SpikeBadgeFocus =
    item.kind === 'cluster'
      ? { kind: 'cluster', clusterId: item.clusterId }
      : {
          kind: 'post',
          redditId: item.redditId,
          signalId: item.signalId,
        };
  const spike = spikeFocusToQueryParam(focus);
  const params = new URLSearchParams({ view: 'signaler' });
  if (spike) params.set('spike', spike);
  return `${routes.adminResearch}?${params.toString()}`;
}

export function rowIsListedInSpikeBadge(
  row: { id: string; redditId: string; clusterId: string | null },
  badge: RedditSpikeBadgeView | null,
): boolean {
  if (!badge) return false;
  return badge.items.some((item) => {
    const focus: SpikeBadgeFocus =
      item.kind === 'cluster'
        ? { kind: 'cluster', clusterId: item.clusterId }
        : { kind: 'post', redditId: item.redditId, signalId: item.signalId };
    return rowMatchesSpikeFocus(row, focus);
  });
}

export function rowMatchesSpikeFocus(
  row: { id: string; redditId: string; clusterId: string | null },
  focus: SpikeBadgeFocus | null,
): boolean {
  if (!focus) return true;
  if (focus.kind === 'cluster') {
    return Boolean(focus.clusterId && row.clusterId === focus.clusterId);
  }
  if (focus.signalId) return row.id === focus.signalId;
  if (focus.redditId) return row.redditId === focus.redditId;
  return false;
}

/** Fixture for dev `?preview=fixture` (viser badge uten DB). */
export function buildRedditSpikeBadgeFixture(): RedditSpikeBadgeView {
  return {
    items: [
      {
        kind: 'post',
        redditId: 'fixture01',
        label: 'Fixture: høy vekst',
      },
      {
        kind: 'cluster',
        clusterId: 'fixture-klynge-a',
        label: 'Fixture: klynge',
      },
    ],
  };
}