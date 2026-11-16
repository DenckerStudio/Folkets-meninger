/** Kunnskapstest på sakssiden — av som standard; sett `NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ=1` for å vise. */
export function isSakKnowledgeQuizEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ === '1';
}