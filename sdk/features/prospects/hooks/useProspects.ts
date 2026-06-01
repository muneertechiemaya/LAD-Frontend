/**
 * Prospects feature — useProspects hook.
 */
import { useQuery } from '@tanstack/react-query';

import * as api from '../api';
import type { ListProspectsParams, ProspectState } from '../types';

export function useProspects(params?: ListProspectsParams, enabled = true) {
  return useQuery<ProspectState[]>({
    queryKey: ['prospects', params],
    queryFn: () => api.listProspects(params),
    staleTime: 30_000,
    enabled,
  });
}
