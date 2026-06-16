import { createHash } from 'crypto';
import type { StortingetSakDetail } from '@/lib/stortinget';

export type SakDocumentKind =
  | 'lovforslag'
  | 'representantforslag'
  | 'innstilling'
  | 'referat'
  | 'horing'
  | 'annet';

export type SakDocumentRef = {
  id: string;
  title: string;
  kind: SakDocumentKind;
  exportId: string | null;
  sourceUrl: string | null;
  viewable: boolean;
  documentType: string | null;
};

type RawPublikasjonReferanse = {
  eksport_id?: string | null;
  lenke_tekst?: string | null;
  lenke_url?: string | null;
  type?: string | number | null;
  undertype?: string | null;
};

const NUMERIC_TYPE_KIND: Record<number, SakDocumentKind> = {
  1: 'lovforslag',
  2: 'representantforslag',
  6: 'innstilling',
  10: 'referat',
};

const STRING_TYPE_KIND: Record<string, SakDocumentKind> = {
  prop: 'lovforslag',
  proposisjon: 'lovforslag',
  dok8: 'representantforslag',
  inns: 'innstilling',
  innstilling: 'innstilling',
  referat: 'referat',
  refs: 'referat',
  horing: 'horing',
};

export const SAK_DOCUMENT_KIND_LABELS: Record<SakDocumentKind, string> = {
  lovforslag: 'Lovforslag / proposisjon',
  representantforslag: 'Representantforslag',
  innstilling: 'Innstilling',
  referat: 'Referat',
  horing: 'Høring',
  annet: 'Annet',
};

function normalizeSourceUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function hashShort(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function classifyDocumentKind(ref: RawPublikasjonReferanse): SakDocumentKind {
  const exportId = ref.eksport_id?.toLowerCase() ?? '';
  if (exportId.startsWith('prop') || exportId.startsWith('prp')) return 'lovforslag';
  if (exportId.startsWith('dok8')) return 'representantforslag';
  if (exportId.startsWith('inns')) return 'innstilling';
  if (exportId.startsWith('refs') || exportId.startsWith('refe')) return 'referat';

  const undertype = ref.undertype?.toLowerCase() ?? '';
  if (undertype === 'proposisjon') return 'lovforslag';
  if (undertype === 'representantforslag') return 'representantforslag';

  if (typeof ref.type === 'number' && NUMERIC_TYPE_KIND[ref.type]) {
    return NUMERIC_TYPE_KIND[ref.type];
  }

  const typeKey = String(ref.type ?? '').toLowerCase();
  if (STRING_TYPE_KIND[typeKey]) return STRING_TYPE_KIND[typeKey];

  const title = ref.lenke_tekst?.toLowerCase() ?? '';
  if (title.startsWith('prop.')) return 'lovforslag';
  if (title.startsWith('dokument 8')) return 'representantforslag';
  if (title.startsWith('innst.')) return 'innstilling';
  if (title.includes('referat')) return 'referat';

  return 'annet';
}

function deriveDocumentId(ref: RawPublikasjonReferanse, index: number): string {
  const exportId = ref.eksport_id?.trim();
  const sourceUrl = normalizeSourceUrl(ref.lenke_url);
  const title = ref.lenke_tekst?.trim();

  if (exportId) {
    const urlSuffix = sourceUrl?.split('/').filter(Boolean).pop();
    if (urlSuffix && urlSuffix !== exportId && !urlSuffix.startsWith(exportId)) {
      return `${exportId}--${slugPart(urlSuffix)}`;
    }
    return exportId;
  }

  const basis = sourceUrl || title || `ref-${index}`;
  return `external-${hashShort(basis)}`;
}

export function parseSakDocuments(detail: StortingetSakDetail | null | undefined): SakDocumentRef[] {
  const rawList = detail?.publikasjon_referanse_liste;
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const seen = new Set<string>();
  const documents: SakDocumentRef[] = [];

  rawList.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const ref = raw as RawPublikasjonReferanse;
    const title = ref.lenke_tekst?.trim();
    if (!title) return;

    const id = deriveDocumentId(ref, index);
    if (seen.has(id)) return;
    seen.add(id);

    const exportId = ref.eksport_id?.trim() || null;
    const kind = classifyDocumentKind(ref);
    const sourceUrl = normalizeSourceUrl(ref.lenke_url);
    const documentType =
      typeof ref.type === 'number'
        ? String(ref.type)
        : ref.type
          ? String(ref.type)
          : ref.undertype ?? null;

    documents.push({
      id,
      title,
      kind,
      exportId,
      sourceUrl,
      viewable: Boolean(exportId),
      documentType,
    });
  });

  const kindOrder: SakDocumentKind[] = [
    'lovforslag',
    'representantforslag',
    'innstilling',
    'horing',
    'referat',
    'annet',
  ];

  return documents.sort((a, b) => {
    const kindDiff = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
    if (kindDiff !== 0) return kindDiff;
    return a.title.localeCompare(b.title, 'nb');
  });
}

export function groupSakDocumentsByKind<T extends SakDocumentRef>(
  documents: T[]
): Array<{ kind: SakDocumentKind; label: string; documents: T[] }> {
  const groups = new Map<SakDocumentKind, T[]>();
  for (const doc of documents) {
    const list = groups.get(doc.kind) ?? [];
    list.push(doc);
    groups.set(doc.kind, list);
  }

  const kindOrder: SakDocumentKind[] = [
    'lovforslag',
    'representantforslag',
    'innstilling',
    'horing',
    'referat',
    'annet',
  ];

  return kindOrder
    .filter((kind) => groups.has(kind))
    .map((kind) => ({
      kind,
      label: SAK_DOCUMENT_KIND_LABELS[kind],
      documents: groups.get(kind) ?? [],
    }));
}
