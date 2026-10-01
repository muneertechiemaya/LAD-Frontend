/**
 * Tasks Feature SDK — "My Tasks": chats handed to a person, conversations
 * assigned to me, my assignment notifications, and pending approvals.
 *
 *   import { useWaitingChats, useAssignedConversations } from '@lad/frontend-features/tasks';
 */
export {
  taskKeys,
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
