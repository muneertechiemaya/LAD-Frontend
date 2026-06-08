export * from "./features/voice-agent";

export * from "./features/call-logs";

export * from "./features/community-roi";

// `CallLog` is exported by both ./features/voice-agent and ./features/call-logs.
// Re-export the call-logs definition explicitly so the ambiguous star-export is
// resolved (TS2308). Consumers needing the voice-agent shape import it from the
// "@lad/frontend-features/voice-agent" subpath directly.
export type { CallLog } from "./features/call-logs";

export { safeStorage } from "./shared/storage";
export { apiClient, apiGet, apiPost, apiPut, apiDelete, apiPatch } from "./shared/apiClient";
