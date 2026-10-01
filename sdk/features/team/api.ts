/**
 * Team - SDK API
 * LAD Architecture: SDK Layer - HTTP calls ONLY (no business logic)
 *
 * All calls go through the Next.js /api/users/* proxy routes (same-origin),
 * never straight to the backend.
 */

import { apiClient } from '../../shared/apiClient';
import type {
  CreateTeamMemberInput,
  TeamMember,
  TeamPrivacy,
  TeamPrivacyResponse,
} from './types';

export const teamKeys = {
  all: ['team'] as const,
  members: () => [...teamKeys.all, 'members'] as const,
  privacy: () => [...teamKeys.all, 'privacy'] as const,
};

const userPath = (userId: string, suffix = '') =>
  `/api/users/${encodeURIComponent(userId)}${suffix}`;

export async function listTeamMembers(): Promise<TeamMember[]> {
  const res = await apiClient.get<any[]>('/api/users');
  const raw = Array.isArray(res.data) ? res.data : [];
  return raw.map((u: any) => ({
    ...u,
    maskPhoneNumber: !!(u.mask_phone_number ?? u.metadata?.mask_phone_number),
  }));
}

export async function createTeamMember(input: CreateTeamMemberInput): Promise<unknown> {
  const res = await apiClient.post('/api/users', input);
  return res.data;
}

export async function updateTeamMemberRole(userId: string, role: string): Promise<unknown> {
  const res = await apiClient.put(userPath(userId, '/role'), { role });
  return res.data;
}

export async function updateTeamMemberCapabilities(
  userId: string,
  capabilities: string[],
): Promise<unknown> {
  const res = await apiClient.put(userPath(userId, '/capabilities'), { capabilities });
  return res.data;
}

export async function updateTeamMemberMaskPhone(
  userId: string,
  maskPhoneNumber: boolean,
): Promise<unknown> {
  const res = await apiClient.put(userPath(userId, '/mask-phone'), { maskPhoneNumber });
  return res.data;
}

export async function deleteTeamMember(userId: string): Promise<unknown> {
  const res = await apiClient.delete(userPath(userId));
  return res.data;
}

/** Null when the backend did not report success: the switch's state is unknown. */
export async function getTeamPrivacy(): Promise<TeamPrivacy | null> {
  const res = await apiClient.get<TeamPrivacyResponse>('/api/users/team-privacy');
  const data = res.data;
  if (!data?.success) return null;
  return { enabled: !!data.enabled, canEdit: !!data.canEdit };
}

export async function updateTeamPrivacy(enabled: boolean): Promise<TeamPrivacyResponse> {
  const res = await apiClient.put<TeamPrivacyResponse>('/api/users/team-privacy', { enabled });
  if (!res.data?.success) throw new Error(res.data?.error || 'Could not save');
  return res.data;
}
