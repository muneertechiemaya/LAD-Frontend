import { apiGet, apiPatch, apiPost, apiPut } from "../../shared/apiClient";
import type {
  MakeCallRequest,
  MakeCallResponse,
  ResolvePhonesResponse,
  TriggerBatchCallRequest,
  TriggerBatchCallResponse,
  UpdateCallLeadTagsRequest,
  UpdateCallLeadTagsResponse,
  UpdateSummaryRequest,
  UpdateSummaryResponse,
  UserAvailableAgent,
  UserAvailableNumber,
  VoiceAgentTargetType,
} from "./types";

export async function getUserAvailableAgents(): Promise<UserAvailableAgent[]> {
  const response = await apiGet<{ success: boolean; data: UserAvailableAgent[]; count: number }>(
    "/api/voice-agent/user/available-agents",
  );
  return response.data.data || [];
}

export async function getUserAvailableNumbers(): Promise<UserAvailableNumber[]> {
  const response = await apiGet<{ success: boolean; data: UserAvailableNumber[]; count: number }>(
    "/api/voice-agent/available-numbers",
  );
  return response.data.data || [];
}

export async function resolvePhones(
  ids: string[],
  type: VoiceAgentTargetType,
): Promise<ResolvePhonesResponse> {
  const response = await apiPost<ResolvePhonesResponse>(
    "/api/voice-agent/resolve-phones",
    { ids, type },
  );
  return response.data;
}

export async function makeCall(payload: MakeCallRequest): Promise<MakeCallResponse> {
  // Transform phoneNumber to to_number and add voice_id to match backend API expectations.
  //
  // The key names here have to match what the controller destructures out of
  // req.body (features/voice-agent/controllers/call-controllers/
  // CallInitiationController.js): it reads `added_context` and `lead_name`. This
  // used to send `context`, which nothing read, so the instructions typed into
  // the dialog never reached the agent; and it never sent the lead name at all,
  // so the agent asked every caller for a name the dashboard already had
  // (call 6933a237). The batch path already sent both correctly.
  const apiPayload = {
    voice_id: "default", // Required by V2 API
    agent_id: payload.voiceAgentId,
    to_number: payload.phoneNumber,
    added_context: payload.context,
    from_number: payload.fromNumber,
    lead_name: payload.leadName || null,
  };
  const response = await apiPost<MakeCallResponse>(
    "/api/voice-agent/calls/start-call",
    apiPayload,
  );
  return response.data;
}

export async function triggerBatchCall(
  payload: TriggerBatchCallRequest,
): Promise<TriggerBatchCallResponse> {
  const response = await apiPost<TriggerBatchCallResponse>(
    "/api/voice-agent/batch/trigger-batch-call",
    payload,
  );
  return response.data;
}

export async function updateSummary(
  payload: UpdateSummaryRequest,
): Promise<UpdateSummaryResponse> {
  const response = await apiPut<UpdateSummaryResponse>(
    "/api/voice-agent/update-summary",
    payload,
  );
  return response.data;
}

export async function updateCallLeadTags(
  payload: UpdateCallLeadTagsRequest,
): Promise<UpdateCallLeadTagsResponse> {
  const response = await apiPatch<UpdateCallLeadTagsResponse>(
    `/api/voice-agent/calls/${payload.callId}/lead-tags`,
    { tags: payload.tags },
  );
  return response.data;
}