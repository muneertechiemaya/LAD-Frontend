import { memo, useRef, useEffect, useState } from 'react';
import { Conversation, ContactTag } from '@/types/conversation';
import { ChannelIcon } from './ChannelIcon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Pin, Star, Lock, CheckSquare, Square, ChevronDown, MoreVertical, Archive, Trash2, Bell, BellOff, Bookmark, MessageSquare, List, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isSelectMode?: boolean;
  isChecked?: boolean;
  onContextStatusClick?: (status: string) => void;
  onDoubleClick?: () => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMute?: (id: string, duration?: string) => void;
  onPin?: (id: string) => void;
  onFavorite?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onClearChat?: (id: string) => void;
}

const tagConfig: Record<ContactTag, { label: string; className: string }> = {
  hot: {
    label: 'Hot',
    className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
  },
  warm: {
    label: 'Warm',
    className: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
  },
  cold: {
    label: 'Cold',
    className: 'bg-info/10 text-info border-info/20 hover:bg-info/20'
  },
};

/** Distinct colors for each context status */
const CONTEXT_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  onboarding_greeting:          { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  onboarding_profile:           { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  onboarding_complete:          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  icp_discovery:                { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  match_suggested:              { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  coordination_a_availability:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  coordination_b_availability:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  coordination_overlap_proposed:{ bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  post_meeting_followup:        { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200' },
  kpi_query:                    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  idle:                         { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
  general_qa:                   { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
};

const DEFAULT_STATUS_COLOR = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

function getStatusColor(status: string) {
  return CONTEXT_STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
}

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
  isSelectMode = false,
  isChecked = false,
  onContextStatusClick,
  onDoubleClick,
  onArchive,
  onDelete,
  onMute,
  onPin,
  onFavorite,
  onMarkUnread,
  onClearChat,
}: ConversationListItemProps) {
  const { contact, lastMessage, unreadCount, channel, updatedAt } = conversation;
  const hasUnread = unreadCount > 0;
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isHovered, setIsHovered] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [clearChatModal, setClearChatModal] = useState(false);
  const [deleteChatModal, setDeleteChatModal] = useState(false);
  const [addToListModal, setAddToListModal] = useState(false);

  const handleItemClick = () => {
    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      clickTimeoutRef.current = setTimeout(() => {
        // Single click - just select
        onSelect(conversation.id);
        clickCountRef.current = 0;
      }, 300); // Wait 300ms to detect double-click
    } else if (clickCountRef.current === 2) {
      // Double click detected
      clearTimeout(clickTimeoutRef.current);
      onDoubleClick?.();
      clickCountRef.current = 0;
    }
  };

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const timeAgo = formatDistanceToNow(updatedAt, { addSuffix: false });
  const primaryTag = contact.tags?.[0];
  const labels = conversation.labels || [];

  return (
    <>
    <div
      className={cn(
        'conversation-item group flex items-start gap-3 p-3 border-b border-border/50 cursor-pointer transition-colors relative',
        isSelected && 'conversation-item-active bg-primary/5',
        hasUnread && 'conversation-item-unread',
        isChecked && 'bg-primary/10'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(conversation.id)}
    >
      {/* Checkbox in select mode */}
      {isSelectMode && (
        <div className="flex-shrink-0 pt-1">
          {isChecked ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Dropdown menu trigger - shows on hover */}
      {!isSelectMode && (
        <div className="flex-shrink-0 pt-1 relative z-20">
          <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDropdown(!showDropdown);
                }}
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center transition-all duration-150',
                  'opacity-0 group-hover:opacity-100',
                  showDropdown && 'opacity-100',
                  'bg-gray-100 dark:bg-gray-800'
                )}
              >
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[#233138] border-gray-200 dark:border-[#374045]">
              <DropdownMenuItem onClick={() => { onArchive?.(conversation.id); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                <Archive className="h-4 w-4 mr-2" />
                Archive Chat
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                  <Bell className="h-4 w-4 mr-2" />
                  Mute Notifications
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-white dark:bg-[#233138] border-gray-200 dark:border-[#374045]">
                  <DropdownMenuItem onClick={() => { onMute?.(conversation.id, '8h'); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                    8 Hours
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { onMute?.(conversation.id, '1w'); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                    1 Week
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { onMute?.(conversation.id, 'always'); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                    Always
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => { onPin?.(conversation.id); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                <Pin className="h-4 w-4 mr-2" />
                {conversation.is_pinned ? 'Unpin Chat' : 'Pin Chat'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onMarkUnread?.(conversation.id); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                <MessageSquare className="h-4 w-4 mr-2" />
                Mark as Unread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onFavorite?.(conversation.id); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                <Star className="h-4 w-4 mr-2" />
                {conversation.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setAddToListModal(true); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                <List className="h-4 w-4 mr-2" />
                Add to List
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-200 dark:bg-[#374045]" />
              <DropdownMenuItem onClick={() => { setClearChatModal(true); setShowDropdown(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#374045]">
                <MessageSquare className="h-4 w-4 mr-2" />
                Clear Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setDeleteChatModal(true); setShowDropdown(false); }} className="text-red-600 dark:text-red-500 hover:bg-gray-100 dark:hover:bg-[#374045]">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Avatar with channel icon overlay */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-11 w-11">
          <AvatarImage src={contact.avatar} alt={contact.name} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-card border-2 border-card flex items-center justify-center">
          <ChannelIcon channel={channel} size={12} />
        </span>
        {contact.isOnline && (
          <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Pin indicator */}
            {conversation.is_pinned && (
              <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0 rotate-45" />
            )}
            {/* Favorite indicator */}
            {conversation.is_favorite && (
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
            {/* Lock indicator */}
            {conversation.is_locked && (
              <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            <span className={cn('text-sm truncate', hasUnread ? 'font-semibold' : 'font-medium')}>
              {contact.name}
            </span>
            {primaryTag && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-4 font-medium border',
                  tagConfig[primaryTag].className
                )}
              >
                {tagConfig[primaryTag].label}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {contact.company && (
            <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
          )}
          {(() => {
            const rawStatus = conversation.conversationState || conversation.context_status;
            if (!rawStatus) return null;
            const colors = getStatusColor(rawStatus);
            const label = rawStatus
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            return (
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] px-1.5 py-0 h-3.5 font-medium border cursor-pointer hover:opacity-80 transition-opacity',
                  colors.bg, colors.text, colors.border,
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onContextStatusClick?.(rawStatus);
                }}
                title={`Filter by: ${label}`}
              >
                {label}
              </Badge>
            );
          })()}
        </div>

        <div className="flex items-center justify-between mt-1">
          <p
            className={cn(
              'text-sm truncate max-w-[180px]',
              hasUnread ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {lastMessage?.isOutgoing && <span className="text-muted-foreground">You: </span>}
            {lastMessage?.content || 'No messages yet'}
          </p>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Label dots */}
            {labels.length > 0 && (
              <div className="flex items-center gap-0.5">
                {labels.slice(0, 3).map((label) => (
                  <span
                    key={label.id}
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                    title={label.name}
                  />
                ))}
                {labels.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{labels.length - 3}</span>
                )}
              </div>
            )}

            {hasUnread && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#25D366] text-white text-xs font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Clear Chat Confirmation Modal */}
    <Dialog open={clearChatModal} onOpenChange={setClearChatModal}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-white dark:bg-[rgb(22,23,23)]" showCloseButton={false}>
        <DialogTitle className="sr-only">Clear Chat</DialogTitle>
        <div className="flex flex-col">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e9edef] mb-2">Clear all messages?</h2>
            <p className="text-gray-600 dark:text-[#8696a0] text-sm">This will permanently delete all messages in this chat.</p>
          </div>
          <div className="flex gap-2 p-4 pt-0">
            <button
              onClick={() => setClearChatModal(false)}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-[#2a3942] hover:bg-gray-200 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClearChat?.(conversation.id);
                setClearChatModal(false);
              }}
              className="flex-1 px-4 py-2 bg-[#d5485d] hover:bg-[#e5395e] text-white rounded-lg font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Chat Confirmation Modal */}
    <Dialog open={deleteChatModal} onOpenChange={setDeleteChatModal}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-white dark:bg-[rgb(22,23,23)]" showCloseButton={false}>
        <DialogTitle className="sr-only">Delete Chat</DialogTitle>
        <div className="flex flex-col">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e9edef] mb-2">Delete this chat permanently?</h2>
            <p className="text-gray-600 dark:text-[#8696a0] text-sm">This will delete the chat and all messages permanently.</p>
          </div>
          <div className="flex gap-2 p-4 pt-0">
            <button
              onClick={() => setDeleteChatModal(false)}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-[#2a3942] hover:bg-gray-200 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDelete?.(conversation.id);
                setDeleteChatModal(false);
              }}
              className="flex-1 px-4 py-2 bg-[#d5485d] hover:bg-[#e5395e] text-white rounded-lg font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Add to List Modal */}
    <Dialog open={addToListModal} onOpenChange={setAddToListModal}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-white dark:bg-[rgb(22,23,23)]" showCloseButton={false}>
        <DialogTitle className="sr-only">Add to List</DialogTitle>
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e9edef]">Add to List</h2>
            <button
              onClick={() => setAddToListModal(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <button
              onClick={() => setAddToListModal(false)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] transition-colors"
            >
              Work
            </button>
            <button
              onClick={() => setAddToListModal(false)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] transition-colors"
            >
              Family
            </button>
            <button
              onClick={() => setAddToListModal(false)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] transition-colors"
            >
              Friends
            </button>
            <button
              onClick={() => setAddToListModal(false)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] transition-colors"
            >
              Custom...
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
});
