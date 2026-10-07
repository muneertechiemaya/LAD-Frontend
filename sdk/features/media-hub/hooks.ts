'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import type { GenerateImageInput, ReferenceStatus } from './types';

export const mediaHubKeys = {
  all: ['mediaHub'] as const,
  gallery: (days: number) => [...mediaHubKeys.all, 'gallery', days] as const,
  job: (id: string) => [...mediaHubKeys.all, 'job', id] as const,
  references: () => [...mediaHubKeys.all, 'references'] as const,
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

export function useReferences(enabled = true) {
  return useQuery({ queryKey: mediaHubKeys.references(), queryFn: api.getReferences, enabled, staleTime: 60_000 });
}

export function useToggleReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.toggleReference(id, enabled),
    onSuccess: (_v, { id, enabled }) => {
      qc.setQueryData<ReferenceStatus>(mediaHubKeys.references(), (s) =>
        s ? { ...s, assets: s.assets.map((a) => (a.id === id ? { ...a, enabled } : a)) } : s
      );
      qc.invalidateQueries({ queryKey: mediaHubKeys.references() });
    },
  });
}
