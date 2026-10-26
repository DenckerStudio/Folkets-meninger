import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ragSrc = readFileSync(new URL('./rag.ts', import.meta.url), 'utf8');
const toolsSrc = readFileSync(new URL('./tools.ts', import.meta.url), 'utf8');
const actionsSrc = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8');
const sakActionSrc = readFileSync(new URL('./sak-context.ts', import.meta.url), 'utf8');
const routeSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
const rettSrc = readFileSync(new URL('../../app/api/chat/rettskriving/route.ts', import.meta.url), 'utf8');
const sourcesSrc = readFileSync(new URL('../../app/api/chat/sources/route.ts', import.meta.url), 'utf8');
const sakSrc = readFileSync(new URL('../../app/api/chat/sak-context/route.ts', import.meta.url), 'utf8');

assert.match(ragSrc, /getChatRagRpcClient/);
assert.match(ragSrc, /getServerSupabase/);
assert.match(ragSrc, /getAnonSupabase/);
assert.match(ragSrc, /issue_id, document_id, chunk_index, content/);
assert.match(ragSrc, /rankChunkForSak/);
assert.doesNotMatch(ragSrc, /hits\.length > 0 \? hits : ranked/);
assert.doesNotMatch(ragSrc, /\.select\([^)]*embedding/);

assert.match(toolsSrc, /client: ragClient/);
assert.match(toolsSrc, /searchIssuesForChat\(query, 8, ragClient\)/);

assert.match(routeSrc, /requireStemmePlus/);
assert.match(routeSrc, /getServerSupabase/);
assert.match(routeSrc, /loadDecryptedByok\(gate\.userId, session\)/);
assert.match(routeSrc, /createChatTools\(\{/);
assert.match(routeSrc, /ragClient,/);
assert.match(routeSrc, /userId: gate\.userId/);
assert.match(routeSrc, /impactProfile: readImpactProfile\(body\)/);
assert.match(routeSrc, /isStepCount\(8\)/);
assert.doesNotMatch(routeSrc, /getServiceSupabase/);
assert.doesNotMatch(routeSrc, /runtime\s*=\s*['"]edge['"]/);

assert.match(rettSrc, /requireStemmePlus/);
assert.match(rettSrc, /loadDecryptedByok\(gate\.userId, session\)/);
assert.match(rettSrc, /getServerSupabase/);
assert.match(rettSrc, /resolveRettsskrivingResult/);
assert.doesNotMatch(rettSrc, /streamText/);
assert.doesNotMatch(rettSrc, /runtime\s*=\s*['"]edge['"]/);
assert.match(sourcesSrc, /requireStemmePlus/);
assert.match(sourcesSrc, /runUpdatedSourceSearch/);
assert.doesNotMatch(sourcesSrc, /loadDecryptedByok/);
assert.doesNotMatch(sourcesSrc, /streamText/);

assert.match(actionsSrc, /parseSakContextInput/);
assert.doesNotMatch(actionsSrc, /embedding/);
assert.match(sakActionSrc, /retrieveSakContext/);
assert.match(sakActionSrc, /client: input\.client/);
assert.doesNotMatch(sakActionSrc, /embedding/);
assert.doesNotMatch(sakActionSrc, /streamText/);
assert.match(sakSrc, /requireStemmePlus/);
assert.match(sakSrc, /runSakContextRetrieve/);
assert.doesNotMatch(sakSrc, /loadDecryptedByok/);
assert.doesNotMatch(sakSrc, /streamText/);
assert.doesNotMatch(sakSrc, /getServiceSupabase/);
assert.doesNotMatch(sakSrc, /runtime\s*=\s*['"]edge['"]/);

const composerAssistsSrc = readFileSync(
  new URL('../../components/opinions/composer-stemme-assists.tsx', import.meta.url),
  'utf8',
);
assert.match(composerAssistsSrc, /Rettskriv/);
assert.match(composerAssistsSrc, /Finn oppdaterte kilder/);
assert.match(composerAssistsSrc, /\/api\/chat\/rettskriving/);
assert.match(composerAssistsSrc, /\/api\/chat\/sources/);

// --- Phase 1: multi-sak + semantic retrieval -------------------------------

const vectorSrc = readFileSync(new URL('./vector-search.ts', import.meta.url), 'utf8');
const instructionsSrc = readFileSync(new URL('./instructions.ts', import.meta.url), 'utf8');

// rag.ts keeps the session/anon cache path and stays free of the embedding column.
assert.match(ragSrc, /from '@\/lib\/chat\/vector-search'/);
assert.match(ragSrc, /retrieveTopicContext/);
assert.match(ragSrc, /mergeChunks/);
assert.match(ragSrc, /searchChunksByVector/);
assert.doesNotMatch(ragSrc, /\.select\([^)]*embedding/);

// Semantic path lives in its own module and only calls the vector RPC.
assert.match(vectorSrc, /match_issue_document_chunks/);
assert.match(vectorSrc, /createOllamaVectorizer/);
assert.doesNotMatch(vectorSrc, /\.select\(/);

assert.match(toolsSrc, /retrieveTopicContext/);
assert.match(toolsSrc, /vectorize/);
assert.match(routeSrc, /createOllamaVectorizer/);
assert.match(instructionsSrc, /retrieveTopicContext/);

// --- Phase 2: Stortinget votering + folkets vilje ---------------------------

const voteSrc = readFileSync(new URL('./vote-alignment.ts', import.meta.url), 'utf8');
const cardSrc = readFileSync(new URL('../../components/chat/chat-tool-result.tsx', import.meta.url), 'utf8');

// Vote totals come from the anon/authenticated RPC, never the service role.
assert.doesNotMatch(voteSrc, /getServiceSupabase/);
assert.match(voteSrc, /getServerSupabase/);
assert.match(voteSrc, /getAnonSupabase/);
assert.match(voteSrc, /get_issue_vote_totals/);
assert.match(voteSrc, /buildAlignmentComparison/);
assert.match(voteSrc, /fetchSakVoteringer/);
assert.doesNotMatch(voteSrc, /embedding/);

assert.match(toolsSrc, /getVoteResults/);
assert.match(toolsSrc, /fetchVoteAlignment/);
// Prompt v2 keeps tool descriptions in tool(); the focused profile lists the tool.
assert.match(toolsSrc, /'getVoteResults',/);
assert.match(cardSrc, /tool-getVoteResults/);
assert.match(cardSrc, /VoteResultsCard/);

// --- Phase 3: actions, follow-ups, local conversations, document citations -----

const stemmeChatSrc = readFileSync(
  new URL('../../components/chat/stemme-chat.tsx', import.meta.url),
  'utf8',
);
const messageActionsSrc = readFileSync(
  new URL('../../components/chat/chat-message-actions.tsx', import.meta.url),
  'utf8',
);
const conversationMenuSrc = readFileSync(
  new URL('../../components/chat/chat-conversation-menu.tsx', import.meta.url),
  'utf8',
);
const conversationsSrc = readFileSync(new URL('./conversations.ts', import.meta.url), 'utf8');
const followUpsSrc = readFileSync(new URL('./follow-ups.ts', import.meta.url), 'utf8');
const documentsSectionSrc = readFileSync(
  new URL('../../components/sak/sak-documents-section.tsx', import.meta.url),
  'utf8',
);
const sakPageSrc = readFileSync(
  new URL('../../app/dashboard/sak/[id]/page.tsx', import.meta.url),
  'utf8',
);

// C4: per-message copy + regenerate.
assert.match(messageActionsSrc, /data-chat-action="copy"/);
assert.match(messageActionsSrc, /data-chat-action="regenerate"/);
assert.match(messageActionsSrc, /navigator\.clipboard/);
assert.match(stemmeChatSrc, /ChatMessageActions/);
assert.match(stemmeChatSrc, /regenerate\(\{ messageId: message\.id \}\)/);

// C3: follow-up chips on the latest assistant reply.
assert.match(followUpsSrc, /buildFollowUps/);
assert.match(stemmeChatSrc, /data-chat-follow-ups/);
assert.match(stemmeChatSrc, /buildFollowUps/);

// C1: conversations stay in localStorage — never a server transcript.
assert.match(conversationMenuSrc, /data-chat-action="new-chat"/);
assert.match(conversationsSrc, /folkets:chat:conversations/);
assert.match(conversationsSrc, /localStorage/);
assert.doesNotMatch(conversationsSrc, /fetch\(/);
assert.doesNotMatch(conversationsSrc, /supabase/i);
assert.match(stemmeChatSrc, /ChatConversationMenu/);

// The retired "Hent sakskontekst" block is gone from the chat chrome.
assert.doesNotMatch(stemmeChatSrc, /Hent sakskontekst/);
assert.doesNotMatch(conversationMenuSrc, /Hent sakskontekst/);

// C2: document citations deep-link into the sak viewer.
assert.match(cardSrc, /dokument=\$\{encodeURIComponent\(chunk\.documentId\)\}/);
assert.match(documentsSectionSrc, /initialDocumentId/);
assert.match(sakPageSrc, /initialDocumentId=\{initialDocumentId\}/);

// --- Phase 4: poll results, my activity, impact, public profile -------------

const pollToolsSrc = readFileSync(new URL('./poll-tools.ts', import.meta.url), 'utf8');
const personalToolsSrc = readFileSync(new URL('./personal-tools.ts', import.meta.url), 'utf8');
const pollsServiceSrc = readFileSync(new URL('../polls/service.ts', import.meta.url), 'utf8');
const publicProfileSrc = readFileSync(new URL('../public-profile.ts', import.meta.url), 'utf8');
const impactProfileHelperSrc = readFileSync(
  new URL('../../components/chat/impact-profile-for-chat.ts', import.meta.url),
  'utf8',
);

// Tool wiring stays in createChatTools, delegating to the new modules.
assert.match(toolsSrc, /createPollChatTools/);
assert.match(toolsSrc, /createPersonalChatTools/);
assert.match(toolsSrc, /userId: resolved\.userId/);

// Poll aggregates read through the session/anon RPC — never the service role.
assert.match(pollToolsSrc, /getPollTotals/);
assert.match(pollToolsSrc, /getPollTotalsByFylke/);
assert.match(pollToolsSrc, /findPublicPollForIssue/);
assert.match(pollToolsSrc, /searchPublicPolls/);
assert.doesNotMatch(pollToolsSrc, /getServiceSupabase/);
assert.match(pollsServiceSrc, /export async function getPollTotals/);
assert.match(pollsServiceSrc, /grant EXECUTE|resolvePollReadClient/);

// My activity uses session-derived userId only; no userId tool argument.
assert.match(personalToolsSrc, /getMyActivity/);
assert.match(personalToolsSrc, /getImpact/);
assert.match(personalToolsSrc, /getPublicProfile/);
assert.match(personalToolsSrc, /getOwnPublicProfilePreview/);
assert.doesNotMatch(personalToolsSrc, /userId: z\.string/);

// Public profile preview never touches the service role.
assert.match(publicProfileSrc, /getOwnPublicProfilePreview/);
assert.match(publicProfileSrc, /getAnonSupabase/);
assert.doesNotMatch(
  publicProfileSrc.slice(publicProfileSrc.indexOf('getOwnPublicProfilePreview')),
  /getServiceSupabase/,
);

// Prompt v2: personal tools stay in the focused profile; poll and public-profile
// tools remain defined (cards still render) but are not sent to the model.
assert.match(toolsSrc, /'getMyActivity',/);
assert.match(toolsSrc, /'getImpact',/);
assert.match(instructionsSrc, /getImpact/);
assert.match(toolsSrc, /getPollResults/);
assert.match(toolsSrc, /getPublicProfile/);
assert.match(cardSrc, /tool-getPollResults/);
assert.match(cardSrc, /PollResultsCard/);
assert.match(cardSrc, /tool-getMyActivity/);
assert.match(cardSrc, /MyActivityCard/);
assert.match(cardSrc, /tool-getImpact/);
assert.match(cardSrc, /ImpactCard/);
assert.match(cardSrc, /tool-getPublicProfile/);
assert.match(cardSrc, /PublicProfileCard/);

// Impact profile is read browser-side and forwarded in the request body.
assert.match(impactProfileHelperSrc, /readImpactProfileForChat/);
assert.match(stemmeChatSrc, /readImpactProfileForChat/);
assert.match(stemmeChatSrc, /prepareSendMessagesRequest/);

console.log('chat/rag.session.test.ts: ok session-bound overlay RAG');
