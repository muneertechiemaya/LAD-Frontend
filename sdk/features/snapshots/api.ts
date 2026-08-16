// Vertical snapshots SDK — API layer. All HTTP for this feature lives here.
//
// Routes through the shared apiClient, which (in the browser) goes same-origin
// via the Next.js [feature]/[...path] proxy. The proxy mirrors backend paths
// 1:1, so /api/snapshot/* needs no additional plumbing.
import { apiGet, apiPatch } from '../../shared/apiClient';
import type { PipelineOverview, PipelineKey, KnobValues } from './types';

const BASE = '/api/snapshot';

/**
 * The Pipelines page payload: entitlement, the tenant's own on/off state, and
 * campaign counts for each of the four pipelines.
 *
 * Returns `vertical: null` with an empty list for a tenant outside a snapshot —
 * that is a valid response, not an error.
 */
export async function getPipelineOverview(): Promise<PipelineOverview> {
  const res = await apiGet<{ success: boolean; data: PipelineOverview }>(`${BASE}/pipelines`);
  return res.data.data;
}

/**
 * Flip the tenant's activation switch for one pipeline.
 *
 * This changes only whether the tenant has it switched ON. It cannot grant an
 * entitlement — the server refuses with 403 `not_entitled` if the workspace
 * does not already have the pipeline.
 */
export async function setPipelineActive(
  key: PipelineKey,
  active: boolean
): Promise<{ key: PipelineKey; active: boolean }> {
  const res = await apiPatch<{ success: boolean; data: { key: PipelineKey; active: boolean } }>(
    `${BASE}/pipelines/${key}`,
    { active }
  );
  return res.data.data;
}

/**
 * Save settings for one pipeline. Send only the fields that changed — the
 * server merges over what is stored rather than replacing it, which is what
 * keeps a newer snapshot version's values intact across a rollback.
 *
 * Validation is server-side; on failure the response carries a `details` array
 * of per-field messages.
 */
export async function setPipelineKnobs(
  key: PipelineKey,
  values: KnobValues
): Promise<{ key: PipelineKey; values: KnobValues }> {
  const res = await apiPatch<{ success: boolean; data: { key: PipelineKey; values: KnobValues } }>(
    `${BASE}/pipelines/${key}/knobs`,
    { values }
  );
  return res.data.data;
}
