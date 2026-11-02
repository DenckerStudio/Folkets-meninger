import { z } from 'zod';

export const adminUserListQuerySchema = z
  .object({
    q: z.string().max(200).optional(),
    role: z.enum(['all', 'admin', 'member']).optional(),
    tier: z.enum(['all', 'stemme_plus', 'free']).optional(),
    status: z.enum(['all', 'active', 'deactivated']).optional(),
    sort: z.enum(['created_at', 'email', 'last_sign_in', 'display_name']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().min(1).max(10_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const adminUserPatchSchema = z
  .object({
    isAdmin: z.boolean().optional(),
    subscriptionTier: z.enum(['stemme_plus', 'free']).optional(),
    reactivate: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Empty body' });

export const adminUserDeleteQuerySchema = z.object({
  mode: z.enum(['deactivate', 'anonymize', 'hard']),
});

export const adminUserHardDeleteBodySchema = z
  .object({
    confirmEmail: z.string().trim().min(3).max(320),
  })
  .strict();

export const adminUserBulkSchema = z
  .object({
    userIds: z.array(z.string().uuid()).min(1).max(100),
    action: z.enum([
      'set_admin',
      'revoke_admin',
      'grant_stemme_plus',
      'revoke_stemme_plus',
      'deactivate',
      'reactivate',
    ]),
  })
  .strict();

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminUserPatchBody = z.infer<typeof adminUserPatchSchema>;
export type AdminUserBulkBody = z.infer<typeof adminUserBulkSchema>;
