import { safeStorage } from '@lad/shared/storage';  
import { logger } from '../lib/logger';
import { io, Socket } from 'socket.io-client';
import store from '../store/store';
import {
  addMessageToConversation,
  updateConversation
} from '../store/slices/conversationSlice';
import { addNotification } from '../store/slices/notificationSlice';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';
let socket: Socket | null = null;
interface Conversation {
  id: string;
  [key: string]: unknown;
}
interface Message {
  id?: string | number;
  _id?: string | number;
  content?: string;
  role?: string;
  human_agent_id?: string | number;
  sender_name?: string;
  senderName?: string;
  created_at?: string | number;
  timestamp?: string | number;
  type?: string;
  metadata?: {
    tags?: unknown[];
    read_receipt?: boolean;
    delivery_status?: string;
  };
  message_status?: string;
  [key: string]: unknown;
}
interface ConversationActivityPayload {
  conversationId: string;
  messages?: Message[];
  lastMessage?: Message;
  updatedAt?: string | number;
  unread?: number;
  leadId?: string;
  lead?: { name?: string };
}
interface ConversationListener {
  (data: Conversation): void;
}
interface MessageListener {
  (msg: Message): void;
}
interface SocketStatus {
  connected: boolean;
  id: string | null;
  readyState: number | null;
  url: string;
  timestamp: string;
}
class ChatService {
  conversationListeners: Set<ConversationListener>;
  messageListeners: Map<string, Set<MessageListener>>;
  socket: Socket | null;
  currentConversationId: string | null;
  constructor() {
    this.conversationListeners = new Set();
    this.messageListeners = new Map();
    this.socket = null;
    this.currentConversationId = null;
    this.initSocket();
  }
  initSocket(): void {
    if (!socket) {
      socket = io(SOCKET_URL, { 
        transports: ['websocket'],
        forceNew: true,
        autoConnect: true,
        timeout: 20000,
        secure: true,
        rejectUnauthorized: false,
        upgrade: false,
        rememberUpgrade: false
      });
      this.socket = socket;
      socket.on('connect', () => {
        logger.debug('Socket connected', { socketId: socket?.id });
        // Only join the currently active conversation room after (re)connect
        try {
          const state = store.getState();
          const activeConversationId = (state.conversation as { activeConversationId?: string })?.activeConversationId;
          if (activeConversationId) {
            this.joinConversationRoom(activeConversationId);
          }
        } catch (e) {
          logger.error('Error joining active room', e);
        }
      });
      socket.on('disconnect', () => {
        logger.debug('Socket disconnected', { socketId: socket?.id });
      });
      // Listen for new conversations (always a single conversation object)
      socket.on('conversation:new', (data: Conversation) => {
        this.notifyConversationListeners(data);
      });
      // Listen for notification:new events for badge/unread updates
      socket.on('notification:new', ({ conversation_id, message }: { conversation_id: string; message: Message }) => {
        logger.debug('Received notification event', { conversation_id });
        // Robust notification id fallback: prefer message.id, else message._id, else conversation_id+timestamp
        let notifId: string;
        if (message && message.id) {
          notifId = String(message.id);
        } else if (message && message._id) {
          notifId = String(message._id);
        } else {
          notifId = `${conversation_id}_${Date.now()}`;
        }
        // Debug log
        const state = store.getState();
        logger.debug('Processing notification', { conversation_id, notifId });
        const notifications = (state.notification as { notifications?: Array<{ id: string | number }> })?.notifications || [];
        logger.debug('Current notification IDs', { count: notifications.length });
        // Prevent duplicate notifications (by id)
        const existing = notifications.find(n => String(n.id) === notifId);
        if (!existing) {
          store.dispatch(addNotification({
            id: notifId,
            conversationId: conversation_id,
            content: message?.content,
            senderName: message?.sender_name || message?.senderName,
            timestamp: message?.created_at || message?.timestamp || Date.now(),
          }));
          logger.debug('Notification dispatched', { notifId });
        } else {
          logger.debug('Duplicate notification ignored', { notifId });
        }
      });
      // Log errors (keep error logs)
      socket.on('error', (err: Error) => {
        logger.error('Socket error', err);
      });
      // Test notification handler for development
      socket.on('test:notification', (data: { conversation_id?: string; message?: Message }) => {
        logger.debug('Received test notification', { hasConversationId: !!data?.conversation_id });
        // Handle test notification the same way as regular notification:new
        const { conversation_id, message } = data;
        if (conversation_id && message) {
          const notifId = `${conversation_id}_${message.id || Date.now()}`;
          const state = store.getState();
          const notifications = (state.notification as { notifications?: Array<{ id: string | number }> })?.notifications || [];
          const existing = notifications.find(n => String(n.id) === notifId);
          if (!existing) {
            store.dispatch(addNotification({
              id: notifId,
              conversationId: conversation_id,
              content: message.content || 'Test notification',
              senderName: message.sender_name || 'Test User',
              timestamp: message.created_at || Date.now(),
            }));
            logger.debug('Created test notification', { notifId });
          }
        }
      });
    }
  }
  // Join a single conversation room (corrected: pass only the conversationId)
  joinConversationRoom(conversationId: string): void {
    logger.debug('Joining room', { conversationId });
    if (socket) {
      socket.emit('join', conversationId);
    }
  }
  // Removed joinConversationRooms: joining multiple rooms is no longer supported. Only join the active room
  notifyMessageListeners(conversationId: string, msg: Message): void {
    this.messageListeners.get(conversationId)?.forEach(callback => callback(msg));
  }
  subscribeToConversations(callback: ConversationListener): () => void {
    this.conversationListeners.add(callback);
    return () => {
      this.conversationListeners.delete(callback);
    };
  }
  // Leave a single conversation room
  leaveConversationRoom(conversationId: string): void {
    logger.debug('Leaving room', { conversationId });
    if (socket && conversationId) {
      socket.emit('leave', conversationId);
    }
  }
  notifyConversationListeners(data: Conversation): void {
    this.conversationListeners.forEach(callback => callback(data));
  }
  async getConversations(): Promise<Conversation[]> {
    try {
      // Fetch from tenant-aware Python conversation service via Next.js proxy
      // The proxy extracts tenantId from the JWT to route to the correct tenant DB
      const response = await fetch('/api/whatsapp-conversations/conversations', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${safeStorage.getItem('token') || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const result = await response.json();
      // Python service returns {success, data, total} - unwrap the data array
      const conversations = result.data || result;
      logger.debug('Conversations fetched', { count: Array.isArray(conversations) ? conversations.length : 0 });
      return conversations as Conversation[];
    } catch (error) {
      logger.error('Error fetching conversations', error);
      throw error;
    }
  }
  // Get socket connection status
  getSocketStatus(): SocketStatus {
    const status: SocketStatus = {
      connected: socket?.connected || false,
      id: socket?.id || null,
      readyState: (socket as { readyState?: number })?.readyState || null,
      url: SOCKET_URL,
      timestamp: new Date().toISOString()
    };
    logger.debug('Socket status:', status);
    return status;
  }
  // Extract conversation activity handling logic to reuse
  handleConversationActivity(payload: ConversationActivityPayload): void {
    logger.debug('Handle conversation activity', { messageCount: payload.messages?.length });
    // Same logic as the conversation:activity event handler
    if (Array.isArray(payload.messages)) {
      logger.debug('Processing messages', { count: payload.messages.length });
      payload.messages.forEach((msg: Message) => {
        logger.debug('Processing individual message', {
          id: msg.id || msg._id,
          content: msg.content,
          senderId: msg.human_agent_id,
          senderName: msg.sender_name || msg.senderName,
          timestamp: msg.created_at || msg.timestamp,
          messageType: msg.type,
          role: msg.role
        });
        store.dispatch(addMessageToConversation({
          conversationId: payload.conversationId,
          message: msg,
          isActive: false
        }));
        // Create notification logic for real backend data
        const state = store.getState();
        const currentUserId = (state.auth as { user?: { id?: string; user?: { id?: string } } })?.user?.id || 
                              (state.auth as { user?: { user?: { id?: string } } })?.user?.user?.id;
        if (msg.human_agent_id && String(msg.human_agent_id) !== String(currentUserId)) {
          logger.debug('Creating notification for new message', { conversationId: payload.conversationId });
          const notifId = `${payload.conversationId}_${msg.id || msg._id || Date.now()}`;
          const notifications = (state.notification as { notifications?: Array<{ id: string | number }> })?.notifications || [];
          const existing = notifications.find(n => String(n.id) === notifId);
          if (!existing) {
            store.dispatch(addNotification({
              id: notifId,
              conversationId: payload.conversationId,
              content: msg.content || 'New message received',
              senderName: msg.sender_name || msg.senderName || 'Unknown User',
              timestamp: msg.created_at || msg.timestamp || Date.now(),
            }));
            logger.debug('Notification created', { notifId });
          } else {
            logger.debug('Notification already exists, skipping', { notifId });
          }
        } else {
          logger.debug('Message is from current user, no notification needed');
        }
      });
    }
    const updatePayload: {
      id: string;
      lastMessage?: Message;
      updatedAt?: string | number;
      unread?: number;
    } = {
      id: payload.conversationId,
      lastMessage: payload.lastMessage,
      updatedAt: payload.updatedAt,
    };
    if (typeof payload.unread === 'number') {
      updatePayload.unread = payload.unread;
    }
    store.dispatch(updateConversation(updatePayload));
  }
}
const chatService = new ChatService();
export default chatService;
