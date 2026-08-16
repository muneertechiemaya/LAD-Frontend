'use client';

/**
 * Vertical snapshot hooks. The web layer calls these — never the api module or
 * fetch directly.
 */

import { useCallback, useEffect, useState } from 'react';
import { getPipelineOverview, setPipelineActive, setPipelineKnobs } from './api';
import type { PipelineOverview, PipelineKey, KnobValues } from './types';

export interface UsePipelinesState {
  overview: PipelineOverview | null;
  isLoading: boolean;
  error: string | null;
  /** Pipeline currently being toggled, so only that card shows a pending state. */
  pendingKey: PipelineKey | null;
  /** Pipeline whose settings are saving. */
  savingKey: PipelineKey | null;
  toggle: (key: PipelineKey, active: boolean) => Promise<void>;
  /**
   * Save settings. Returns per-field error messages from the server, or an
   * empty array on success — the caller shows them next to the form rather
   * than in the page-level banner.
   */
  saveKnobs: (key: PipelineKey, values: KnobValues) => Promise<string[]>;
  reload: () => Promise<void>;
}

/** Pull the server's per-field messages out of an apiClient error, if present. */
function fieldErrorsFrom(err: unknown): string[] {
  const details = (err as { response?: { data?: { details?: unknown } } })?.response?.data?.details;
  if (Array.isArray(details) && details.every((d) => typeof d === 'string')) return details;
  return [];
}

export function usePipelines(): UsePipelinesState {
  const [overview, setOverview] = useState<PipelineOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<PipelineKey | null>(null);
  const [savingKey, setSavingKey] = useState<PipelineKey | null>(null);

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

  const saveKnobs = useCallback(async (key: PipelineKey, values: KnobValues): Promise<string[]> => {
    setSavingKey(key);
    setError(null);

    try {
      const saved = await setPipelineKnobs(key, values);
      // Take the server's resolved values rather than the submitted ones —
      // it applies defaults and normalisation (trimming, de-duplication), so
      // echoing the form input back would drift from what is stored.
      setOverview((prev) => prev && {
        ...prev,
        pipelines: prev.pipelines.map((p) =>
          p.key === key ? { ...p, knobValues: saved.values } : p
        ),
      });
      return [];
    } catch (err) {
      const fieldErrors = fieldErrorsFrom(err);
      if (fieldErrors.length === 0) {
        setError(err instanceof Error ? err.message : 'Could not save those settings');
      }
      return fieldErrors;
    } finally {
      setSavingKey(null);
    }
  }, []);

  return { overview, isLoading, error, pendingKey, savingKey, toggle, saveKnobs, reload: load };
}
