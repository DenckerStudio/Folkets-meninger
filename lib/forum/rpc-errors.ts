import { FORUM_IDENTITY_ERROR } from '@/lib/forum/require-forum-identity';

export function mapForumRpcError(message: string | undefined): string {
  const msg = message ?? '';
  if (msg.includes('first and last name') || msg.includes('Complete your profile')) {
    return FORUM_IDENTITY_ERROR;
  }
  if (msg.includes('MODERATION_REJECTED:')) {
    return msg.split('MODERATION_REJECTED:')[1]?.trim() || 'Innlegget bryter forumreglene.';
  }
  return 'Kunne ikke fullføre handlingen. Prøv igjen.';
}
