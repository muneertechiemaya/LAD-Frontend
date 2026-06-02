/**
 * useBusinessProfile
 *
 * Single hook for the 14-field business profile. Read on mount; write via
 * `save(partial)`; expose computed completeness so wizard / Settings /
 * chat all show the same "X / 14" indicator.
 *
 * Follows the raw useState/useEffect convention used by other hooks in
 * this SDK (see useActiveIcpDefinition.ts — TanStack Query is intentionally
 * NOT used here).
 */
import { useCallback, useEffect, useState } from 'react';

import {
  BusinessProfile,
  computeCompleteness,
  emptyBusinessProfile,
  type BusinessProfileCompleteness,
} from '../businessProfile';
import { getBusinessProfile, saveBusinessProfile } from '../businessProfileApi';

export interface UseBusinessProfileResult {
  /** The merged profile (server state + any locally-saved partial). Always
   *  defined; starts as `emptyBusinessProfile()` until the first load completes. */
  profile: BusinessProfile;
  /** True while the initial load is in flight. */
  loading: boolean;
  /** True while a save() call is in flight. */
  saving: boolean;
  /** Most recent load OR save error, or null. */
  error: Error | null;
  /** Persist a partial update. Optimistically merges into local state so
   *  the UI reflects the change immediately; rolls back on server error. */
  save: (partial: Partial<BusinessProfile>) => Promise<BusinessProfile>;
  /** Re-fetch from the server. */
  refetch: () => Promise<void>;
  /** Shared completeness math — same source as the discovery drawer. */
  completeness: BusinessProfileCompleteness;
}

export function useBusinessProfile(): UseBusinessProfileResult {
  const [profile, setProfile] = useState<BusinessProfile>(() => emptyBusinessProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBusinessProfile();
      // Merge server state on top of the empty defaults so the form always
      // has every canonical key (avoids `value={undefined}` warnings on inputs).
      setProfile({ ...emptyBusinessProfile(), ...(result || {}) });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load business profile'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (partial: Partial<BusinessProfile>): Promise<BusinessProfile> => {
      // The backend does a FULL replace of icp_data (routes/index.js:421), so
      // we must merge the partial onto the latest local state and POST the
      // whole object. Use functional setState to grab the latest snapshot
      // without adding `profile` to the dep array (which would re-create save
      // on every keystroke).
      let snapshot: BusinessProfile = emptyBusinessProfile();
      let merged: BusinessProfile = emptyBusinessProfile();
      setProfile((prev) => {
        snapshot = prev;
        merged = { ...prev, ...partial };
        return merged;
      });
      setSaving(true);
      setError(null);
      try {
        await saveBusinessProfile(merged);
        return merged;
      } catch (err) {
        setProfile(snapshot); // rollback
        const e = err instanceof Error ? err : new Error('Failed to save business profile');
        setError(e);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return {
    profile,
    loading,
    saving,
    error,
    save,
    refetch: load,
    completeness: computeCompleteness(profile),
  };
}
