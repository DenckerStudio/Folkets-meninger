import { createHash } from 'node:crypto';
import { fetchPublikasjonHtml } from '@/lib/stortinget-publikasjon';
import { exportIdFromPublicationUrl } from '@/lib/stortinget-publication-url';
import {
  buildHoringsprogramMarkdown,
  hearingDocumentsFromExport,
  type HearingDocumentDraft,
  type StortingetHoringsprogram,
} from '@/lib/stortinget-hearing-export';
import {
  getHoringSkriftligInnspillUrl,
  getHoringTitle,
  type StortingetHoring,
} from '@/lib/stortinget-horinger';

export function buildHearingOverviewMarkdown(hearing: StortingetHoring): string | null {
  const lines: string[] = [];
  const title = getHoringTitle(hearing);
  if (title) lines.push(`# ${title}`);
  const status = hearing.status_info_tekst?.trim();
  if (status) {
    lines.push('');
    lines.push(status);
  }
  const sak = hearing.horing_sak_info_liste?.[0];
  if (sak?.sak_henvisning?.trim()) {
    lines.push('');
    lines.push(`Henvisning: ${sak.sak_henvisning.trim()}`);
  }
  if (sak?.sak_korttittel?.trim() && sak.sak_korttittel.trim() !== title) {
    lines.push('');
    lines.push(sak.sak_korttittel.trim());
  }
  const innspillUrl = getHoringSkriftligInnspillUrl(hearing);
  if (innspillUrl) {
    lines.push('');
    lines.push(`Skriftlig innspill: ${innspillUrl}`);
  }
  const body = lines.join('\n').trim();
  return body.length >= 40 ? body : null;
}

async function fetchPublicationPlainText(exportId: string, maxChars: number): Promise<string | null> {
  const pub = await fetchPublikasjonHtml(exportId);
  if (!pub?.plainText) return null;
  return pub.plainText.slice(0, maxChars);
}

export async function resolveHearingDraftMarkdown(
  draft: HearingDocumentDraft,
  maxChars: number,
): Promise<string | null> {
  if (draft.markdown?.trim()) return draft.markdown.slice(0, maxChars);
  if (!draft.sourceUrl) return null;
  const exportId = exportIdFromPublicationUrl(draft.sourceUrl);
  if (!exportId) return null;
  return fetchPublicationPlainText(exportId, maxChars);
}

export type ResolvedHearingDocument = {
  draft: HearingDocumentDraft;
  markdown: string;
};

/** Real Stortinget exports only — program, sak_publikasjon HTML, and API overview fields. */
export async function resolveHearingDocumentsForIngest(
  hearing: StortingetHoring,
  program: StortingetHoringsprogram | null,
  maxPublicationChars: number,
): Promise<ResolvedHearingDocument[]> {
  const drafts = hearingDocumentsFromExport(hearing, program);
  const resolved: ResolvedHearingDocument[] = [];

  for (const draft of drafts) {
    const markdown = await resolveHearingDraftMarkdown(draft, maxPublicationChars);
    if (markdown) resolved.push({ draft, markdown });
  }

  if (resolved.length === 0) {
    const overview = buildHearingOverviewMarkdown(hearing);
    if (overview) {
      resolved.push({
        draft: {
          externalKey: 'horing_export:overview',
          title: getHoringTitle(hearing),
          kind: 'horing_export',
          sourceUrl: null,
          markdown: overview,
          status: 'converted',
          contentHash: createHash('sha256').update(overview, 'utf8').digest('hex'),
        },
        markdown: overview,
      });
    }
  }

  return resolved;
}

export { buildHoringsprogramMarkdown };
