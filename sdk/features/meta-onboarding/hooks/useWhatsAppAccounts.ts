/**
 * Meta Onboarding - useWhatsAppAccounts
 * Lists the tenant's connected WhatsApp accounts and exposes a disconnect action.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWhatsAppAccountsOptions, disconnectWhatsAppAccount, registerWhatsAppNumber,
  metaOnboardingKeys,
} from '../api';
import type { WhatsAppAccount } from '../types';

export interface UseWhatsAppAccountsReturn {
  accounts: WhatsAppAccount[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  disconnect: (accountId: string) => Promise<void>;
  isDisconnecting: boolean;
  /** Non-fatal issues from the last disconnect (e.g. Meta unsubscribe failed). */
  disconnectWarnings: string[];
  /** Register a number Meta left unregistered. Rejects with Meta's own message. */
  registerNumber: (accountId: string) => Promise<void>;
  isRegistering: boolean;
  /** Meta's refusal, verbatim - the user has to act on it, so it must not be swallowed. */
  registerError: string | null;
}

export function useWhatsAppAccounts(): UseWhatsAppAccountsReturn {
  const queryClient = useQueryClient();
  const query = useQuery(getWhatsAppAccountsOptions());

  const mutation = useMutation({
    mutationFn: disconnectWhatsAppAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: metaOnboardingKeys.whatsappAccounts() });
    },
  });

  const register = useMutation({
    mutationFn: registerWhatsAppNumber,
    onSuccess: () => {
      // Refetch rather than patch: the row's phone_registration is what decides
      // whether the action stays on screen, and the server owns that.
      queryClient.invalidateQueries({ queryKey: metaOnboardingKeys.whatsappAccounts() });
    },
  });

  return {
    accounts:  query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error,
    refetch:   query.refetch,
    disconnect: async (accountId: string) => {
      await mutation.mutateAsync(accountId);
    },
    isDisconnecting:    mutation.isPending,
    disconnectWarnings: mutation.data?.warnings ?? [],
    registerNumber: async (accountId: string) => {
      await register.mutateAsync(accountId);
    },
    isRegistering: register.isPending,
    registerError: register.error
      ? ((register.error as { response?: { data?: { error?: string } } })?.response?.data?.error
         ?? (register.error as Error).message)
      : null,
  };
}
