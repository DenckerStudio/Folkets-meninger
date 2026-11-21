import { createAboutSuggestion, type AboutSuggestion, type AboutWrittenPiece } from '@/lib/blog/about-suggestions';
import { OM_FAQ, OM_INTRO, OM_PROCESS_STEPS } from '@/lib/landing/om-content';
import {
  STEMME_PLUS_BENEFITS,
  STEMME_PLUS_NON_INFLUENCE_NOTE,
} from '@/lib/stemme-plus/constants';

export type AboutWebHit = {
  title: string;
  url: string;
  snippet: string;
};

const WEB_LIMIT = 3;

type WebTheme = {
  id: string;
  pattern: RegExp;
  title: string;
  angle: string;
  clarify: string;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

export function isOwnFolketsDomain(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  return host === 'folkets-meninger.no' || host.endsWith('.folkets-meninger.no');
}

function isRetiredBrandHost(host: string): boolean {
  return host === 'folkets-stemme.no' || host.endsWith('.folkets-stemme.no');
}

export function isRedditWebHit(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return (
    host === 'reddit.com' ||
    host.endsWith('.reddit.com') ||
    host === 'redd.it' ||
    host.endsWith('.redd.it')
  );
}

export function keepExternalWebHits(hits: AboutWebHit[]): AboutWebHit[] {
  const seen = new Set<string>();
  const kept: AboutWebHit[] = [];
  for (const hit of hits) {
    const url = hit.url.trim();
    const host = hostOf(url);
    if (!host || isOwnFolketsDomain(url) || isRetiredBrandHost(host)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    kept.push({ title: hit.title.trim(), url, snippet: hit.snippet.trim() });
  }
  return kept;
}

function webThemes(): WebTheme[] {
  const representativitet = OM_FAQ.find((entry) => entry.id === 'representativitet');
  const avstemning = OM_PROCESS_STEPS.find((step) => step.title === 'Avstemninger');
  return [
    {
      id: 'representativitet',
      pattern: /representativ|meningsmåling|gallup|hele norge/,
      title: 'Klargjør at tallene ikke er representative',
      angle: representativitet?.answer ?? '',
      clarify: 'at tallene ikke er representative for hele Norge',
    },
    {
      id: 'avstemning',
      pattern: /avstemning/,
      title: 'Slik fungerer avstemningene',
      angle: avstemning?.body ?? '',
      clarify: 'hvordan avstemningene virker',
    },
    {
      id: 'stemme',
      pattern: /stemme\s*\+/,
      title: 'Hva Stemme+ er',
      angle: `Stemme+ gir: ${STEMME_PLUS_BENEFITS.join('; ')}. ${STEMME_PLUS_NON_INFLUENCE_NOTE}`,
      clarify: 'hva Stemme+ gir',
    },
    {
      id: 'tjenesten',
      pattern: /folkets[\s-]+meninger|folkets-meninger/,
      title: 'Hva Folkets Meninger er',
      angle: OM_INTRO,
      clarify: 'hva tjenesten er',
    },
  ];
}

function classify(hit: AboutWebHit, themes: WebTheme[]): WebTheme {
  const hay = `${hit.title}\n${hit.snippet}`.toLocaleLowerCase('nb');
  return themes.find((theme) => theme.pattern.test(hay)) ?? themes[themes.length - 1];
}

export function buildWebAboutSuggestions(
  hits: AboutWebHit[],
  written: AboutWrittenPiece[] = [],
): AboutSuggestion[] {
  const themes = webThemes();
  const fallback = themes[themes.length - 1];
  const groups = new Map<string, { theme: WebTheme; hits: AboutWebHit[] }>();

  for (const hit of keepExternalWebHits(hits)) {
    const theme = classify(hit, themes) ?? fallback;
    const group = groups.get(theme.id) ?? { theme, hits: [] };
    group.hits.push(hit);
    groups.set(theme.id, group);
  }

  const suggestions: AboutSuggestion[] = [];
  for (const group of groups.values()) {
    const external = group.hits.find((hit) => !isRedditWebHit(hit.url)) ?? null;
    const interestOnly = external === null;
    const mention = external ?? group.hits[0];
    const reason = interestOnly
      ? `Et diskusjonsinnlegg omtaler tjenesten og er bare et interessesignal, så vurder å klargjøre ${group.theme.clarify} ut fra teksten på Om-siden.`
      : `Noen skriver om ${group.theme.clarify}, så vurder å klargjøre det ut fra teksten på Om-siden.`;
    const suggestion = createAboutSuggestion({
      key: `nett:${group.theme.id}`,
      title: group.theme.title,
      angle: group.theme.angle,
      reason,
      source: 'nett',
      written,
      provenance: {
        mentionUrl: mention?.url,
        interestOnly,
      },
    });
    if (!suggestion) continue;
    suggestions.push(suggestion);
    if (suggestions.length >= WEB_LIMIT) break;
  }
  return suggestions;
}
