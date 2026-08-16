'use client';

/**
 * Vertical snapshot hooks. The web layer calls these — never the api module or
 * fetch directly.
 */

import { useCallback, useEffect, useState } from 'react';
import { getPipelineOverview, setPipelineActive } from './api';
import type { PipelineOverview, PipelineKey } from './types';

export interface UsePipelinesState {
  overview: PipelineOverview | null;
  isLoading: boolean;
  error: string | null;
  /** Pipeline currently being toggled, so only that card shows a pending state. */
  pendingKey: PipelineKey | null;
  toggle: (key: PipelineKey, active: boolean) => Promise<void>;
  reload: () => Promise<void>;
}

export function usePipelines(): UsePipelinesState {
  const [overview, setOverview] = useState<PipelineOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<PipelineKey | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getPipelineOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your pipelines');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async (key: PipelineKey, active: boolean) => {
    setPendingKey(key);
    setError(null);

    // Optimistic: the switch should feel immediate. Reverted below if the
    // server refuses, which it will for a pipeline the workspace is not
    // entitled to.
    setOverview((prev) => prev && {
      ...prev,
      pipelines: prev.pipelines.map((p) => (p.key === key ? { ...p, active } : p)),
    });

    try {
      await setPipelineActive(key, active);
    } catch (err) {
      setOverview((prev) => prev && {
        ...prev,
        pipelines: prev.pipelines.map((p) => (p.key === key ? { ...p, active: !active } : p)),
      });
      setError(
        err instanceof Error
          ? err.message
          : `Could not turn that pipeline ${active ? 'on' : 'off'}`
      );
    } finally {
      setPendingKey(null);
    }
  }, []);

  return { overview, isLoading, error, pendingKey, toggle, reload: load };
}
