/**
 * Deals Pipeline Feature - usePipelineLeads Hook
 *
 * React hook for fetching pipeline leads list (stage/status filters, search, pagination).
 * Framework-independent (no Next.js imports).
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { PaginatedLeads } from "../types";
import * as api from "../api";

export type PipelineLeadsParams = {
  stage?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
};

export function usePipelineLeads(params: PipelineLeadsParams, enabled: boolean = true) {
  return useQuery<PaginatedLeads>({
    queryKey: ["deals-pipeline", "pipeline", "leads", params],
    queryFn: () => api.getPipelineLeads(params),
    staleTime: 30000,
    // Keep showing the last page while the next page or search result loads.
    placeholderData: keepPreviousData,
    enabled,
  });
}
