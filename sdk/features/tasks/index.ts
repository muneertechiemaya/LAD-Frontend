/**
 * Tasks Feature SDK — "My Tasks": chats handed to a person, conversations
 * assigned to me, and my assignment notifications.
 *
 *   import { useWaitingChats, useAssignedConversations } from '@lad/frontend-features/tasks';
 */
export {
  taskKeys,
  getWaitingChats,
  getAssignedConversations,
  getTaskNotifications,
  markTaskNotificationRead,
} from './api';

export {
  useWaitingChats,
  useAssignedConversations,
  useTaskNotifications,
  useMarkTaskNotificationRead,
} from './hooks';

export type { TaskChannel, HandoffChannel, WaitingChat, AssignedConversation, TaskNotification } from './types';
