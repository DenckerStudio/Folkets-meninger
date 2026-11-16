import { ACCOUNT_DELETE_CONFIRMATION_TOKEN } from '@/lib/account-delete/constants';

export function normalizeAccountDeleteConfirmation(input: string): string {
  return input.trim().toUpperCase();
}

export function accountDeleteConfirmationMatches(input: string): boolean {
  return normalizeAccountDeleteConfirmation(input) === ACCOUNT_DELETE_CONFIRMATION_TOKEN;
}