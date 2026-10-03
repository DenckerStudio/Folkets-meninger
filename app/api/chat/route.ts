import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { loadDecryptedByok } from '@/lib/byok/service';
import { buildChatInstructions } from '@/lib/chat/instructions';
import { createUserLanguageModel } from '@/lib/chat/model';
import { createChatTools } from '@/lib/chat/tools';
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

export async function POST(request: Request) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const ipRate = checkRateLimit(`chat:ip:${clientIp(request)}`, 20, 60_000);
  if (!ipRate.ok) {
    return Response.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const userRate = checkRateLimit(`chat:user:${gate.userId}`, 12, 60_000);
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

  const credential = await loadDecryptedByok(gate.userId);
  if (!credential) {
    return Response.json(
      { error: 'Lagre en egen LLM-nøkkel under Stemme+ før du chatter.' },
      { status: 409 },
    );
  }

  const issueId = readIssueId(request, body);
  const ragClient = await getServerSupabase();

  try {
    const model = createUserLanguageModel(credential);
    const result = streamText({
      model,
      instructions: buildChatInstructions(issueId),
      messages: await convertToModelMessages(messages as UIMessage[]),
      tools: createChatTools(issueId, ragClient),
      stopWhen: isStepCount(6),
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
      stream: toUIMessageStream({ stream: result.stream }),
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
