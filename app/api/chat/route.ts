import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { loadDecryptedByok } from '@/lib/byok/service';
import { createCitationRegistry } from '@/lib/chat/citations';
import { buildChatInstructions } from '@/lib/chat/instructions';
import { createChatRagExcerptCollector } from '@/lib/chat/rag-excerpt-collector';
import { createGroundedAnswerStreamTransform } from '@/lib/chat/stream-grounded-answer';
import { parseChatPageContext } from '@/lib/chat/page-context';
import { byokOutboundForUser } from '@/lib/byok/outbound';
import { createUserLanguageModel } from '@/lib/chat/model';
import { createChatTools, selectFocusedChatTools } from '@/lib/chat/tools';
import { createOllamaVectorizer } from '@/lib/chat/vector-search';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function readIssueId(request: Request, body: Record<string, unknown>): string | null {
  const fromHeader = request.headers.get('x-sak-id')?.trim();
  if (fromHeader) return fromHeader;
  const fromBody = body.issueId;
  return typeof fromBody === 'string' && fromBody.trim() ? fromBody.trim() : null;
}

/**
 * Browser-local impact profile, forwarded by the chat client so getImpact can
 * personalize without ever persisting the profile server-side.
 */
function readImpactProfile(body: Record<string, unknown>): unknown {
  return body.impactProfile ?? null;
}

export async function POST(request: Request) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const ipRate = await checkRateLimit(`chat:ip:${clientIp(request)}`, 20, 60_000);
  if (!ipRate.ok) {
    return Response.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const userRate = await checkRateLimit(`chat:user:${gate.userId}`, 12, 60_000);
  if (!userRate.ok) {
    return Response.json(
      { error: 'Du sender for mange meldinger. Vent litt.' },
      { status: 429, headers: { 'Retry-After': String(userRate.retryAfterSeconds) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages)) {
    return Response.json({ error: 'Mangler meldinger' }, { status: 400 });
  }

  const session = await getServerSupabase();
  const credential = await loadDecryptedByok(gate.userId, session);
  if (!credential) {
    return Response.json(
      { error: 'Lagre en egen LLM-nøkkel under Stemme+ før du chatter.' },
      { status: 409 },
    );
  }

  // Structured page context (page type + sakId/personId/pollId/hoeringId/opinionId).
  // Suggestion text stays free of ids; the model gets them via the instructions.
  const pageContext = parseChatPageContext(body.pageContext);
  const issueId = readIssueId(request, body) ?? pageContext?.sakId ?? null;
  const ragClient = session;
  // Reuse the user's own Ollama server to vectorize queries when that is their
  // provider; every other provider keeps the lexical chunk search.
  const outbound = await byokOutboundForUser(gate.userId);
  const vectorize = createOllamaVectorizer(credential, { outbound });

  try {
    const model = await createUserLanguageModel(credential, outbound);
    const citations = createCitationRegistry();
    const ragExcerptCollector = createChatRagExcerptCollector(citations);
    const result = streamText({
      model,
      abortSignal: request.signal,
      instructions: buildChatInstructions(issueId, new Date(), pageContext),
      messages: await convertToModelMessages(messages as UIMessage[]),
      // Focused Stemme+ tool set (plan P2): fewer tool descriptions for small models.
      tools: selectFocusedChatTools(
        createChatTools({
          preferredIssueId: issueId,
          preferredHearingId: pageContext?.hoeringId ?? null,
          ragClient,
          vectorize,
          userId: gate.userId,
          impactProfile: readImpactProfile(body),
          citations,
          ragExcerptCollector,
        }),
      ),
      experimental_transform: createGroundedAnswerStreamTransform(() =>
        ragExcerptCollector.excerptsAlignedWithCitations(),
      ),
      stopWhen: isStepCount(8),
      onError: ({ error }) => {
        const message = error instanceof Error ? error.message : 'unknown chat error';
        if (/sk-|api[_-]?key|bearer\s+[a-z0-9-]+/i.test(message)) {
          console.error('[chat] provider error (redacted)');
          return;
        }
        console.error('[chat] provider error:', message);
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error ?? '');
          if (/sk-|api[_-]?key|bearer\s+[a-z0-9-]+/i.test(message)) {
            console.error('[chat] stream error (redacted)');
          } else {
            console.error('[chat] stream error:', message);
          }
          return 'Modellen svarte ikke. Prøv igjen, eller sjekk modell og nøkkel under Stemme+.';
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/sk-|api[_-]?key|bearer\s+[a-z0-9-]+/i.test(message)) {
      console.error('[chat] failed (redacted)');
    } else {
      console.error('[chat] failed', message);
    }
    return Response.json(
      { error: 'Kunne ikke starte samtalen. Sjekk at nøkkelen og modellen er gyldige.' },
      { status: 502 },
    );
  }
}
