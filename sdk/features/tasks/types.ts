/** My Tasks — things where a person on the team needs to act. */

/** Inbox tabs a task can open in. */
export type TaskChannel = 'waba' | 'personal' | 'linkedin';
/** Channels with a human-handoff state (context_status = 'Human'). LinkedIn has none. */
export type HandoffChannel = Extract<TaskChannel, 'waba' | 'personal'>;

/** A chat Mr LAD handed over to a person (conversation context "Human"). */
export interface WaitingChat {
  conversationId: string;
  channel: HandoffChannel;
  contactName: string;
  preview: string | null;
  /** ISO time of the latest activity. */
  at: string | null;
}

/** A conversation assigned to the current user. */
export interface AssignedConversation {
  assignmentId: string;
  conversationId: string;
  /** null when the contact row is unknown (older backends returned null always). */
  contactName: string | null;
  contactPhone: string | null;
  channel: TaskChannel | null;
  messageCount: number | null;
  assignedAt: string | null;
}

/** A notification delivered to the current user's inbox (assignment delivery). */
export interface TaskNotification {
  id: string;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  preview: string;
  isRead: boolean;
  receivedAt: string | null;
}

/** Something waiting for a human yes/no — see LAD_backend features/approvals. */
export type ApprovalType =
  | 'linkedin_post'
  | 'linkedin_invite'
  | 'linkedin_greeting'
  | 'lead_report'
  | 'market_insight';

export interface PendingApproval {
  type: ApprovalType;
  id: string;
  title: string;
  preview: string | null;
  campaignId: string | null;
  leadId: string | null;
  at: string | null;
}

export interface PendingApprovals {
  items: PendingApproval[];
  /** Sources the backend could not read — "couldn't check", not "nothing". */
  degraded: ApprovalType[];
}

export type ApprovalAction = 'approve' | 'reject';

export interface ApprovalDecision {
  /** false when someone else decided first or it expired — nothing changed. */
  applied: boolean;
  status: string | null;
  message: string | null;
}
