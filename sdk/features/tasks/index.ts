/**
 * Tasks Feature SDK — "My Tasks": chats handed to a person, conversations
 * assigned to me, my assignment notifications, and pending approvals.
 *
 *   import { useWaitingChats, useAssignedConversations } from '@lad/frontend-features/tasks';
 */
export {
  taskKeys,
  WAITING_CHATS_LIMIT,
  getWaitingChats,
  getAssignedConversations,
  getTaskNotifications,
  markTaskNotificationRead,
  getPendingApprovals,
  decideApproval,
} from './api';

export {
  useWaitingChats,
  useAssignedConversations,
  useTaskNotifications,
  useMarkTaskNotificationRead,
  usePendingApprovals,
  useDecideApproval,
  useMyTasksCount,
} from './hooks';

export type {
  TaskChannel,
  HandoffChannel,
  WaitingChat,
  AssignedConversation,
  TaskNotification,
  ApprovalType,
  ApprovalAction,
  ApprovalDecision,
  PendingApproval,
  PendingApprovals,
} from './types';
