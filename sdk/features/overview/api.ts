// Dashboard/Overview SDK API Layer
import { apiDelete, apiGet, apiPost, apiPut } from "../../shared/apiClient";
import type {
  LeadBookingListResponse,
  LeadBookingResponse,
  UsersListResponse,
  GetLeadBookingsParams,
  CreateLeadBookingParams,
  UpdateLeadBookingParams,
  CallLog,
  CallSummary,
  CallLogListResponse,
  WalletStatsResponse,
  PhoneNumberListResponse,
  VoiceAgentListResponse,
  GetDashboardCallsParams,
} from "./types";

/**
 * Get lead bookings with optional filters
 */
export async function getLeadBookings(
  params?: GetLeadBookingsParams
): Promise<LeadBookingListResponse> {
  const query = new URLSearchParams();

  if (params?.user_id) query.append("user_id", params.user_id);
  if (params?.status) query.append("status", params.status);
  if (params?.bookingType) query.append("bookingType", params.bookingType);
  if (params?.bookingSource) query.append("bookingSource", params.bookingSource);
  if (params?.leadId) query.append("leadId", params.leadId);
  if (params?.startDate) query.append("startDate", params.startDate);
  if (params?.endDate) query.append("endDate", params.endDate);
  if (params?.callResult) query.append("callResult", params.callResult);
  if (params?.limit) query.append("limit", params.limit.toString());

  const queryString = query.toString();
  const url = `/api/overview/bookings${queryString ? `?${queryString}` : ""}`;

  const response = await apiGet<any>(url);
  const bookings = response.data?.data || response.data?.bookings || [];
  return { success: true, data: bookings };
}

/**
 * Get a single lead booking by ID
 */
export async function getLeadBookingById(
  bookingId: string
): Promise<LeadBookingResponse> {
  const response = await apiGet<LeadBookingResponse>(
    `/api/overview/bookings/${bookingId}`
  );
  return response.data;
}

/**
 * Create a new lead booking
 */
export async function createLeadBooking(
  data: CreateLeadBookingParams
): Promise<LeadBookingResponse> {
  const response = await apiPost<LeadBookingResponse>(
    "/api/overview/bookings",
    data
  );
  return response.data;
}

/**
 * Update an existing lead booking
 */
export async function updateLeadBooking(
  bookingId: string,
  data: UpdateLeadBookingParams
): Promise<LeadBookingResponse> {
  const response = await apiPut<LeadBookingResponse>(
    `/api/overview/bookings/${bookingId}`,
    data
  );
  return response.data;
}

/**
 * Get tenant users
 */
export async function getTenantUsers(): Promise<UsersListResponse> {
  const response = await apiGet<any>("/api/overview/users");
  const users = response.data?.data || response.data?.users || [];
  return { success: true, data: users };
}

/**
 * Get dashboard calls with optional date range filters
 */
export async function getDashboardCalls(
  params?: GetDashboardCallsParams
): Promise<CallLogListResponse> {
  const query = new URLSearchParams();

  if (params?.startDate) query.append("startDate", params.startDate);
  if (params?.endDate) query.append("endDate", params.endDate);
  if (params?.user_id) query.append("user_id", params.user_id);

  const queryString = query.toString();
  const url = `/api/overview/calls${queryString ? `?${queryString}` : ""}`;

  const res = await apiGet<any>(url);

  // Handle new structure { success, data: { summary, logs } }
  const summary: CallSummary[] = res.data?.data?.summary || res.data?.summary || [];
  const logsRaw: any[] = res.data?.data?.logs || res.data?.logs || [];

  const mappedLogs: CallLog[] = logsRaw.map((r: any) => {
    const leadFullName = [r.lead_first_name, r.lead_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      id: String(
        r.id ??
          r.call_id ??
          r.call_log_id ??
          r.uuid ??
          (typeof crypto !== "undefined"
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(7))
      ),
      from:
        r.agent ||
        r.initiated_by ||
        r.from ||
        r.from_number ||
        r.fromnum ||
        r.source ||
        r.from_number_id ||
        "-",
      to: r.to || r.to_number || r.tonum || "-",
      startedAt:
        r.startedAt ||
        r.started_at ||
        r.created_at ||
        r.createdAt ||
        r.start_time ||
        r.timestamp ||
        r.call_date ||
        "",
      endedAt: r.endedAt ?? r.ended_at ?? r.end_time ?? undefined,
      status: r.status || r.call_status || r.result || "unknown",
      recordingUrl:
        r.recordingUrl ?? r.call_recording_url ?? r.recording_url ?? undefined,
      timeline: r.timeline,
      agentName: r.agent_name ?? r.agent ?? r.voice ?? undefined,
      leadName:
        leadFullName ||
        (r.lead_name ?? r.target ?? r.client_name ?? r.customer_name ?? undefined),
      duration_seconds:
        r.duration_seconds ?? r.call_duration ?? r.duration ?? undefined,
      call_date: r.call_date,
    };
  });

  return {
    success: true,
    data: {
      summary,
      logs: mappedLogs,
    },
  };
}

/**
 * Get wallet/credits statistics
 */
export async function getWalletStats(): Promise<WalletStatsResponse> {
  const response = await apiGet<any>("/api/billing/wallet");
  const walletData = response.data;

  const balance =
    walletData?.wallet?.availableBalance ||
    walletData?.wallet?.currentBalance ||
    walletData?.credits ||
    walletData?.balance ||
    0;

  const usageThisMonth = walletData?.monthly_usage || 0;
  const totalMinutes = balance * 3.7;
  const remainingMinutes = totalMinutes * (1 - usageThisMonth / 100);

  return {
    success: true,
    data: {
      balance,
      totalMinutes,
      remainingMinutes,
      usageThisMonth,
    },
  };
}

/**
 * Get available phone numbers
 */
export async function getAvailableNumbers(): Promise<PhoneNumberListResponse> {
  const response = await apiGet<any>("/api/voice-agent/available-numbers");
  const numbers = response.data?.numbers || response.data?.items || [];
  return { success: true, data: numbers };
}

/**
 * Get available voice agents
 */
export async function getAvailableAgents(): Promise<VoiceAgentListResponse> {
  const response = await apiGet<any>("/api/voice-agent/available-agents");
  const agents = response.data?.data || response.data?.agents || response.data?.items || [];
  return { success: true, data: agents };
}

// ── Home dashboard (fixed layout) ─────────────────────────────────────────
// Thin readers over the same endpoints the old overview widgets used. Each
// throws on a failed request (apiGet raises ApiError on non-2xx) so callers
// can tell "couldn't load" from "nothing to show".

export interface LeadJourneyCounts {
  sent: number;
  accepted: number;
  responded: number;
  sah: number;
  /** A source behind the counts failed — numbers may be low, not zero. */
  degraded: boolean;
}

/**
 * Pipeline counts for a window. The backend computes `counts` from the full
 * result set before slicing the lead lists, so `limit=1` keeps the payload
 * small without changing the numbers.
 */
export async function getLeadJourneyCounts(from: Date, to: Date): Promise<LeadJourneyCounts> {
  const qs = `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&limit=1`;
  const res = await apiGet<any>(`/api/campaigns/lead-journey${qs}`);
  const j = res.data;
  if (j?.success === false) throw new Error(j?.error || 'Lead journey unavailable');
  const c = j?.counts || {};
  const degraded = j?.degraded && typeof j.degraded === 'object'
    ? Object.values(j.degraded).some(Boolean)
    : Boolean(j?.degraded);
  return {
    sent: Number(c.sent) || 0,
    accepted: Number(c.accepted) || 0,
    responded: Number(c.responded) || 0,
    sah: Number(c.sah) || 0,
    degraded,
  };
}

export interface LinkedInSummary {
  sent: number;
  replied: number;
  /** Average reply rate, percent. */
  replyRate: number | null;
}

export async function getLinkedInSummary(): Promise<LinkedInSummary> {
  const res = await apiGet<any>('/api/campaigns/stats');
  const d = res.data?.data ?? res.data ?? {};
  const rate = Number(d.avg_reply_rate);
  return {
    sent: Number(d.total_sent) || 0,
    replied: Number(d.total_replied) || 0,
    replyRate: Number.isFinite(rate) ? rate : null,
  };
}

export interface EmailBroadcastSummary {
  /** Emails sent across the most recent broadcast runs (up to 100 runs). */
  sent: number;
  broadcasts: number;
}

export async function getEmailBroadcastSummary(): Promise<EmailBroadcastSummary> {
  const res = await apiGet<any>('/api/email-comms/broadcast/runs?limit=100');
  const body = res.data;
  const runs: any[] = Array.isArray(body?.runs) ? body.runs : Array.isArray(body) ? body : [];
  return {
    sent: runs.reduce((a, r) => a + (Number(r?.sent_count) || 0), 0),
    broadcasts: runs.length,
  };
}

export interface InstagramSummary {
  threads: number;
  unread: number;
}

export async function getInstagramSummary(): Promise<InstagramSummary> {
  const res = await apiGet<any>('/api/instagram-conversations/conversations');
  const b = res.data;
  const rows: any[] = Array.isArray(b?.data) ? b.data : Array.isArray(b?.conversations) ? b.conversations : Array.isArray(b) ? b : [];
  const unreadOf = (c: any) => Number(c?.unread_count ?? c?.unreadCount ?? c?.unread ?? 0) || 0;
  return { threads: rows.length, unread: rows.filter((r) => unreadOf(r) > 0).length };
}

// ── Home dashboard layout (per-user preference) ───────────────────────────

export interface HomeLayoutSection {
  id: string;
  visible: boolean;
}

export interface HomeLayout {
  sections: HomeLayoutSection[];
}

export interface SavedHomeLayout {
  /** null = the user never customised (or reset) — use the default layout. */
  layout: HomeLayout | null;
  /** The preference store couldn't be read; the default is a stand-in. */
  degraded: boolean;
}

const HOME_LAYOUT_PATH = '/api/user-preferences/home-dashboard';

export async function getHomeLayout(): Promise<SavedHomeLayout> {
  const res = await apiGet<any>(HOME_LAYOUT_PATH);
  const j = res.data;
  const sections = j?.data?.sections;
  return {
    layout: Array.isArray(sections) ? { sections } : null,
    degraded: Boolean(j?.degraded),
  };
}

export async function saveHomeLayout(layout: HomeLayout): Promise<HomeLayout> {
  const res = await apiPut<any>(HOME_LAYOUT_PATH, { sections: layout.sections });
  const sections = res.data?.data?.sections;
  return Array.isArray(sections) ? { sections } : layout;
}

export async function resetHomeLayout(): Promise<void> {
  await apiDelete<any>(HOME_LAYOUT_PATH);
}
