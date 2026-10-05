/**
 * My Tasks — API functions (HTTP only).
 *
 * Every call goes through the app's own `/api/*` proxies, which resolve the
 * tenant and user from the signed token; nothing here sends a tenant id.
 */
import { apiGet, apiPost, apiPut } from '../../shared/apiClient';
import { ApiError } from '../../shared/apiError';
import { proxyClient } from '../../shared/proxyClient';
import type {
  ApprovalAction,
  ApprovalDecision,
  ApprovalType,
  AssignedConversation,
  ContentTasks,
  HandoffChannel,
  PendingApprovals,
  TaskChannel,
  TaskNotification,
  WaitingChat,
} from './types';

export const taskKeys = {
  all: ['tasks'] as const,
  waiting: (channel: HandoffChannel) => [...taskKeys.all, 'waiting', channel] as const,
  assigned: () => [...taskKeys.all, 'assigned'] as const,
  notifications: () => [...taskKeys.all, 'notifications'] as const,
  approvals: () => [...taskKeys.all, 'approvals'] as const,
  content: () => [...taskKeys.all, 'content'] as const,
};

const CHANNELS: readonly TaskChannel[] = ['waba', 'personal', 'linkedin'];
const asChannel = (v: unknown): TaskChannel | null =>
  CHANNELS.includes(v as TaskChannel) ? (v as TaskChannel) : null;

/** Some endpoints return a bare array, others `{ data: [...] }`. */
function rows(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  const data = (body as { data?: unknown } | null)?.data;
  if (Array.isArray(data)) return data;
  throw new Error('Unexpected response shape');
}

/**
 * Chats Mr LAD handed to a person on one channel (context_status "Human").
 * `channel` goes in as a plain query param - the conversations proxy routes on
 * it (waba / personal / linkedin), and proxyClient only defaults it if absent.
 */
/** Page size for waiting chats; a channel returning this many may have more (UI shows "20+"). */
export const WAITING_CHATS_LIMIT = 20;

export async function getWaitingChats(channel: HandoffChannel): Promise<WaitingChat[]> {
  const res = await proxyClient.get<unknown>('/api/whatsapp-conversations/conversations', {
    params: { context_status: 'Human', limit: String(WAITING_CHATS_LIMIT), offset: '0', channel },
  });
  return rows(res.data).map((c) => ({
    conversationId: String(c.id),
    channel,
    contactName: c.lead_name || c.lead_phone || c.phone || 'Contact',
    preview: c.last_message_content ?? null,
    at: c.last_message_at ?? c.updated_at ?? null,
  }));
}

export async function getAssignedConversations(): Promise<AssignedConversation[]> {
  const res = await apiGet<unknown>('/api/me/assigned-conversations', {
    params: { active_only: 'true', limit: '50' },
  });
  return rows(res.data).map((a) => ({
    assignmentId: String(a.id),
    conversationId: String(a.conversation_id),
    contactName: a.contact_name ?? null,
    contactPhone: a.contact_phone ?? null,
    channel: asChannel(a.channel),
    messageCount: typeof a.message_count === 'number' ? a.message_count : null,
    assignedAt: a.assigned_at ?? null,
  }));
}

export async function getTaskNotifications(): Promise<TaskNotification[]> {
  const res = await apiGet<unknown>('/api/me/inbox', { params: { limit: '50', offset: '0' } });
  return rows(res.data).map((m) => ({
    id: String(m.id),
    conversationId: String(m.conversation_id),
    contactName: m.contact_name || 'Contact',
    contactPhone: m.contact_phone || '',
    preview: m.message_preview || '',
    isRead: !!m.is_read,
    receivedAt: m.received_at ?? null,
  }));
}

export async function markTaskNotificationRead(id: string): Promise<void> {
  await apiPut(`/api/inbox/${encodeURIComponent(id)}/read`);
}

export async function getPendingApprovals(): Promise<PendingApprovals> {
  const res = await apiGet<{ data?: PendingApprovals }>('/api/approvals/pending');
  const data = res.data?.data;
  if (!data || !Array.isArray(data.items)) throw new Error('Unexpected response shape');
  return { items: data.items, degraded: Array.isArray(data.degraded) ? data.degraded : [] };
}

/**
 * Approve / reject in the app. The server resolves the item's single-use link
 * token itself and runs the same handler the WhatsApp/email link runs.
 * 409 = already decided elsewhere or expired: not an error, nothing changed.
 */
export async function decideApproval(type: ApprovalType, id: string, action: ApprovalAction): Promise<ApprovalDecision> {
  try {
    const res = await apiPost<{ data?: { status?: string; message?: string | null } }>(
      `/api/approvals/${encodeURIComponent(type)}/${encodeURIComponent(id)}/decision`,
      { action },
    );
    return { applied: true, status: res.data?.data?.status ?? null, message: res.data?.data?.message ?? null };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { applied: false, status: null, message: err.body?.message ?? 'Already decided.' };
    }
    throw err;
  }
}

/** Content Studio's to-dos: posts due, today's posts, unscheduled drafts, gaps, accounts to connect. */
export async function getContentTasks(): Promise<ContentTasks> {
  const res = await apiGet<{ data?: ContentTasks }>('/api/content-studio/tasks');
  const data = res.data?.data;
  if (!data || !Array.isArray(data.items)) throw new Error('Unexpected response shape');
  return { items: data.items, counts: { actionable: data.counts?.actionable ?? data.items.filter((i) => i.actionable).length }, degraded: !!data.degraded };
}
