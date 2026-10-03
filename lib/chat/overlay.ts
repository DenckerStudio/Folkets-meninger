export type ChatGateReason = 'login' | 'free' | 'no-key' | 'ready';

export type ChatIssueContext = {
  issueId: string;
  issueTitle?: string | null;
};

export function resolveChatGate(input: {
  authenticated: boolean;
  hasStemmePlus: boolean;
  hasByok: boolean;
}): ChatGateReason {
  if (!input.authenticated) return 'login';
  if (!input.hasStemmePlus) return 'free';
  if (!input.hasByok) return 'no-key';
  return 'ready';
}

export function shouldOpenChatFromSearchParams(params: {
  get: (name: string) => string | null;
}): boolean {
  const chat = params.get('chat');
  return chat === '1' || chat === 'open';
}

export function chatDeepLinkQuery(issueId?: string | null): string {
  const params = new URLSearchParams({ chat: '1' });
  const sak = issueId?.trim();
  if (sak) params.set('sak', sak);
  return params.toString();
}
