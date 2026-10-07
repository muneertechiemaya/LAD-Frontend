/**
 * Promo Video Feature - Hooks
 *
 * TanStack Query over api.ts. Framework-independent (no Next.js imports).
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiErrorStatus } from '../../shared/apiError';
import * as api from './api';
import type { PromoOptions, PromoVideoJob, StartPromoVideoInput, StartPromoVideoResult } from './types';

/** How often a video in progress is polled. A render takes minutes. */
export const PROMO_POLL_MS = 4000;

export function usePromoOptions(enabled = true) {
  return useQuery<PromoOptions>({
    queryKey: ['promo-video', 'options'],
    queryFn: api.getPromoOptions,
    enabled,
    staleTime: 60_000,
  });
}

export function useStartPromoVideo() {
  return useMutation<StartPromoVideoResult, Error, StartPromoVideoInput>({
    mutationFn: api.startPromoVideo,
  });
}

/**
 * One video's status, polled while it is being made and left alone once it
 * ends. Key on `data === undefined` for "not loaded yet", not on `isError`:
 * a failed poll keeps the last good status rather than blanking the page.
 */
export function usePromoVideo(jobId: string | null) {
  return useQuery<PromoVideoJob>({
    queryKey: ['promo-video', 'job', jobId],
    queryFn: () => api.getPromoVideo(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && status !== 'processing') return false;
      // A 4xx (no such video, not yours) is an answer, not a blip: stop asking.
      if (query.state.status === 'error' && isClientError(query.state.error)) return false;
      return PROMO_POLL_MS;
    },
    refetchIntervalInBackground: true,
    retry: (count, error) => !isClientError(error) && count < 2,
  });
}

function isClientError(error: unknown): boolean {
  const status = apiErrorStatus(error);
  return status !== undefined && status >= 400 && status < 500;
}
