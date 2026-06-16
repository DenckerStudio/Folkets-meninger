/** Debatt- og stemmevennlige sakstyper fra Stortingets API. */
export type SakKind = 'lovforslag' | 'representantforslag';

export type SakPresentationInput = {
  korttittel?: string | null;
  tittel?: string | null;
  henvisning?: string | null;
  dokumentgruppe?: number | null;
};

const LOVFORSLAG_HENVISNING = /\b(?:Prop\.\s*\d+\s*L|Innst\.\s*\d+\s*L|Lovvedtak)\b/i;
const REPRESENTANTFORSLAG_HENVISNING = /Dokument\s*8\b/i;

const REPRESENTANTFORSLAG_TITLE_PREFIX =
  /^Representantforslag(?:\s+fra\s+(?:stortingsrepresentant(?:en|ene)?|representant(?:en|ene)?)\s+.+?)?\s+om\s+/i;

export function classifySakKind(sak: SakPresentationInput): SakKind | null {
  const henvisning = (sak.henvisning ?? '').trim();
  const dokumentgruppe = sak.dokumentgruppe ?? null;

  if (dokumentgruppe === 1 && LOVFORSLAG_HENVISNING.test(henvisning)) {
    return 'lovforslag';
  }

  if (dokumentgruppe === 4 && REPRESENTANTFORSLAG_HENVISNING.test(henvisning)) {
    return 'representantforslag';
  }

  return null;
}

export function isDebattSak(sak: SakPresentationInput): sak is SakPresentationInput & { sakKind: SakKind } {
  return classifySakKind(sak) !== null;
}

export function getSakKindLabel(kind: SakKind): string {
  switch (kind) {
    case 'lovforslag':
      return 'Lovforslag';
    case 'representantforslag':
      return 'Representantforslag';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildSakDisplayTitle(sak: SakPresentationInput): string {
  const raw = (sak.korttittel || sak.tittel || '').trim();
  if (!raw) return '';

  const kind = classifySakKind(sak);

  if (kind === 'representantforslag') {
    const stripped = raw.replace(REPRESENTANTFORSLAG_TITLE_PREFIX, '').trim();
    if (stripped) {
      return capitalizeFirst(stripped);
    }
  }

  return raw;
}

export function buildSakDisplaySummary(sak: SakPresentationInput, displayTitle: string): string {
  const tittel = (sak.tittel || '').trim();
  const henvisning = (sak.henvisning || '').trim();
  const kind = classifySakKind(sak);

  if (kind === 'representantforslag' && tittel && tittel !== displayTitle) {
    return tittel;
  }

  if (kind === 'lovforslag') {
    if (henvisning && displayTitle) {
      return `${henvisning} — ${displayTitle}`;
    }
    return henvisning || tittel || displayTitle;
  }

  if (tittel && tittel !== displayTitle) {
    return tittel;
  }

  return henvisning || tittel || displayTitle;
}

export function buildSakCategory(sak: SakPresentationInput, emneNavn?: string | null): string {
  if (emneNavn?.trim()) {
    return emneNavn.trim();
  }

  const kind = classifySakKind(sak);
  if (kind) {
    return getSakKindLabel(kind);
  }

  return 'Generelt';
}

export function mapSakPresentation(sak: SakPresentationInput & { emneNavn?: string | null }) {
  const kind = classifySakKind(sak);
  const title = buildSakDisplayTitle(sak);
  const summary = buildSakDisplaySummary(sak, title);
  const category = buildSakCategory(sak, sak.emneNavn);

  return {
    kind,
    title,
    summary,
    category,
    henvisning: (sak.henvisning || '').trim() || null,
  };
}
