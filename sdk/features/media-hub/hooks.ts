'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import * as api from './api';
import type { GenerateImageInput } from './types';

export const mediaHubKeys = {
  all: ['mediaHub'] as const,
  gallery: (days: number) => [...mediaHubKeys.all, 'gallery', days] as const,
  job: (id: string) => [...mediaHubKeys.all, 'job', id] as const,
};

export function useMediaGallery(enabled = true, maxAgeDays = 90) {
  return useQuery({ queryKey: mediaHubKeys.gallery(maxAgeDays), queryFn: () => api.getGallery(maxAgeDays), enabled, staleTime: 60_000 });
}

export function useGenerateImage() {
  return useMutation({ mutationFn: (input: GenerateImageInput) => api.generateImage(input) });
}

/** Polls a job that outlived the hold until it finishes. */
export function useImageJob(jobId: string | null) {
  return useQuery({
    queryKey: mediaHubKeys.job(jobId || ''),
    queryFn: () => api.getImageJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && ['completed', 'failed'].includes(q.state.data.status) ? false : 4000),
  });
}
