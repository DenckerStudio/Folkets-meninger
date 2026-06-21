import type { User } from '@supabase/supabase-js';

export type UserVerificationStatus = {
  emailVerified: boolean;
  phoneVerified: boolean;
  fullyVerified: boolean;
};

export function getUserVerificationStatus(user: Pick<User, 'email_confirmed_at' | 'phone_confirmed_at'>): UserVerificationStatus {
  const emailVerified = user.email_confirmed_at != null;
  const phoneVerified = user.phone_confirmed_at != null;

  return {
    emailVerified,
    phoneVerified,
    fullyVerified: emailVerified && phoneVerified,
  };
}

export const PROFILE_BIO_MIN_LENGTH = 20;

export function isProfileBioComplete(bio: string | null | undefined): boolean {
  return (bio?.trim().length ?? 0) >= PROFILE_BIO_MIN_LENGTH;
}

export function canAwardProfileCompletePoints(input: {
  bio: string | null | undefined;
  profileIsPublic: boolean;
  verification: UserVerificationStatus;
}): boolean {
  return (
    input.verification.fullyVerified &&
    input.profileIsPublic &&
    isProfileBioComplete(input.bio)
  );
}
