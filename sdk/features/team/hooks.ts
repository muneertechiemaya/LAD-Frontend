/**
 * Team - SDK Hooks
 * LAD Architecture: SDK Layer - React Query hooks ONLY, no fetch/axios
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTeamMember,
  deleteTeamMember,
  getTeamPrivacy,
  listTeamMembers,
  teamKeys,
  updateTeamMemberCapabilities,
  updateTeamMemberMaskPhone,
  updateTeamMemberRole,
  updateTeamPrivacy,
} from './api';
import type { CreateTeamMemberInput, TeamMember, TeamPrivacy } from './types';

/** Team members of the caller's workspace. */
export function useTeamMembers(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: teamKeys.members(),
    queryFn: listTeamMembers,
    enabled: options.enabled ?? true,
    // A 401 is answered by a login redirect, not a retry.
    retry: false,
  });
}

/** The "Private workspaces" switch. `data` is null when it could not be read. */
export function useTeamPrivacy(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: teamKeys.privacy(),
    queryFn: getTeamPrivacy,
    enabled: options.enabled ?? true,
    retry: false,
  });
}

/**
 * Flip the switch optimistically; on failure it goes back where it was, so it
 * never shows a state the backend did not accept.
 */
export function useUpdateTeamPrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => updateTeamPrivacy(enabled),
    onMutate: async (enabled) => {
      await qc.cancelQueries({ queryKey: teamKeys.privacy() });
      const previous = qc.getQueryData<TeamPrivacy | null>(teamKeys.privacy());
      qc.setQueryData<TeamPrivacy | null>(teamKeys.privacy(), (p) => (p ? { ...p, enabled } : p));
      return { previous };
    },
    onError: (_err, _enabled, ctx) => {
      qc.setQueryData(teamKeys.privacy(), ctx?.previous ?? null);
    },
    onSuccess: (data) => {
      qc.setQueryData<TeamPrivacy | null>(teamKeys.privacy(), (prev) =>
        prev ? { ...prev, enabled: !!data.enabled } : prev,
      );
    },
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamMemberInput) => createTeamMember(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.members() }),
  });
}

export function useUpdateTeamMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateTeamMemberRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.members() }),
  });
}

/** Patch one member in the cached list without a refetch. */
function patchMember(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
  patch: Partial<TeamMember>,
) {
  qc.setQueryData<TeamMember[]>(teamKeys.members(), (prev) =>
    prev?.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
  );
}

export function useUpdateTeamMemberCapabilities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, capabilities }: { userId: string; capabilities: string[] }) =>
      updateTeamMemberCapabilities(userId, capabilities),
    onSuccess: (_data, { userId, capabilities }) => patchMember(qc, userId, { capabilities }),
  });
}

export function useUpdateTeamMemberMaskPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, maskPhoneNumber }: { userId: string; maskPhoneNumber: boolean }) =>
      updateTeamMemberMaskPhone(userId, maskPhoneNumber),
    onSuccess: (_data, { userId, maskPhoneNumber }) =>
      patchMember(qc, userId, { maskPhoneNumber }),
  });
}

export function useDeleteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteTeamMember(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.members() }),
  });
}
