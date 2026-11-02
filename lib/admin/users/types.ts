export type AdminUserRow = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  isAdmin: boolean;
  subscriptionTier: string;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
  isDeactivated: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export type AdminUserListResult = {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUserRow[];
};

export type AdminBulkSkipReason =
  | 'self'
  | 'last_admin'
  | 'not_found'
  | 'stripe_subscription'
  | 'invalid';

export type AdminBulkItemResult = {
  userId: string;
  ok: boolean;
  reason?: AdminBulkSkipReason;
  message?: string;
};
