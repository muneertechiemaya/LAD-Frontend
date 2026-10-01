/**
 * Team - SDK Types
 * Team Management (Settings → Team): members, roles, page capabilities,
 * phone masking and the workspace "Private workspaces" switch.
 */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar?: string;
  phoneNumber?: string;
  capabilities?: string[];
  created_at?: string;
  /** Normalised from `mask_phone_number` / `metadata.mask_phone_number`. */
  maskPhoneNumber?: boolean;
  metadata?: { mask_phone_number?: boolean; [key: string]: unknown };
}

export interface CreateTeamMemberInput {
  name: string;
  email: string;
  password: string;
  role: string;
  phoneNumber: string;
  capabilities: string[];
  maskPhoneNumber: boolean;
}

export interface TeamPrivacy {
  enabled: boolean;
  canEdit: boolean;
}

export interface TeamPrivacyResponse {
  success: boolean;
  enabled?: boolean;
  canEdit?: boolean;
  note?: string;
  error?: string;
}
