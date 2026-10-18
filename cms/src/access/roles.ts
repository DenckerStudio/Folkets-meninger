import type { Access, FieldAccess, PayloadRequest } from 'payload';

export type CmsRole = 'admin' | 'redaktor' | 'agent' | 'reader';

export type UserLike = { id?: string | number; role?: string; email?: string } | null | undefined;

export function roleOf(user: UserLike): CmsRole | null {
  if (!user?.role) return null;
  if (
    user.role === 'admin' ||
    user.role === 'redaktor' ||
    user.role === 'agent' ||
    user.role === 'reader'
  ) {
    return user.role;
  }
  return null;
}

export function isEditor(user: UserLike): boolean {
  const role = roleOf(user);
  return role === 'admin' || role === 'redaktor';
}

export function isAgent(user: UserLike): boolean {
  return roleOf(user) === 'agent';
}

export function isReader(user: UserLike): boolean {
  return roleOf(user) === 'reader';
}

export function canWriteContent(user: UserLike): boolean {
  const role = roleOf(user);
  return role === 'admin' || role === 'redaktor' || role === 'agent';
}

type AccessArgs = { req: PayloadRequest };

export const editorsOnly: Access = ({ req }) => isEditor(req.user as UserLike);

export const adminsOnly: Access = ({ req }) => roleOf(req.user as UserLike) === 'admin';

/** Admin, redaktør, or n8n-agent — not reader. */
export const contentWritersOnly: Access = ({ req }) =>
  Boolean(req.user) && canWriteContent(req.user as UserLike);

export const postsReadAccess: Access = ({ req }) => {
  const role = roleOf(req.user as UserLike);
  if (role === 'admin' || role === 'redaktor') return true;
  if (role === 'agent') return { _status: { equals: 'draft' } };
  return { _status: { equals: 'published' } };
};

export const postsCreateAccess: Access = contentWritersOnly;

export const postsUpdateAccess: Access = ({ req }) => {
  if (!req.user) return false;
  if (isEditor(req.user as UserLike)) return true;
  if (isAgent(req.user as UserLike)) {
    return { _status: { equals: 'draft' } };
  }
  return false;
};

export const postsDeleteAccess: Access = editorsOnly;

export const usersReadAccess: Access = ({ req }) => {
  if (!req.user) return false;
  if (roleOf(req.user as UserLike) === 'admin') return true;
  return { id: { equals: req.user.id } };
};

export const mediaReadAccess: Access = () => true;

export const mediaWriteAccess: Access = contentWritersOnly;

export const mediaDeleteAccess: Access = editorsOnly;

export const taxonomyReadAccess: Access = () => true;

export const taxonomyWriteAccess: Access = editorsOnly;

export const canPublishField: FieldAccess = ({ req }) => isEditor(req.user as UserLike);

/** Evaluate sync Payload access helpers in unit tests. */
export function accessAllows(
  rule: Access,
  req: PayloadRequest,
): boolean | Record<string, unknown> {
  const result = rule({ req });
  if (result instanceof Promise) {
    throw new Error('accessAllows does not support async access rules');
  }
  if (result === undefined) return false;
  return result as boolean | Record<string, unknown>;
}
