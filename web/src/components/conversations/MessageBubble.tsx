import { memo, useState, useEffect } from 'react';
import { ChevronDown, Reply, Download, Pin, Star, Info, MessageCircle, Trash2 } from 'lucide-react';
import { Message } from '@/types/conversation';
import { Check, CheckCheck, Clock, AlertCircle, X, UserCircle, MessageSquare, MapPin, FileText, Music, Video, Download as DownloadIcon, Image as ImageIcon, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AuthenticatedMediaImage } from './AuthenticatedMediaImage';
import {
  isMediaMessage,
  resolveMediaCaption,
  getMessageMediaType,
  getMessageMediaUrl,
  isImageMessage,
  isVideoMessage,
} from './media-utils';

// ── Location card renderer (OpenStreetMap — no API key required) ─────────────
function LocationCard({
  latitude,
  longitude,
  name,
  address,
}: {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}) {
  const googleMapsUrl = `https://maps.google.com/maps?q=${latitude},${longitude}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
  const displayName = name || address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  // Bounding box: ~500 m around the pin
  const delta = 0.005;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
  return (
    <div className="w-full max-w-xs rounded-lg overflow-hidden border border-gray-700 dark:border-[#2a3942]">
      {/* Live map preview — click opens Google Maps */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative"
        title="Open in Google Maps"
      >
        <iframe
          src={embedUrl}
          className="w-full h-36 border-0 pointer-events-none select-none"
          scrolling="no"
          title="Location preview"
          loading="lazy"
        />
        {/* invisible overlay so the whole thumbnail is clickable as a link */}
        <div className="absolute inset-0" />
      </a>
      {/* Footer bar */}
      <div className="bg-gray-900 dark:bg-[#1f2c33] px-3 py-2 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[#00a884] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-semibold truncate">{displayName}</p>
          <p className="text-gray-400 text-[11px] mt-0.5">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        </div>
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[10px] text-gray-500 hover:text-[#00a884] transition-colors shrink-0"
          title="Open in OpenStreetMap"
        >
          OSM ↗
        </a>
      </div>
    </div>
  );
}

// ── Plain-text renderer with clickable URLs ───────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s]+/g;

function highlightQuery(content: string, query?: string) {
  if (!query || !query.trim()) return content;
  const parts = content.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-amber-300 text-black px-0.5 rounded dark:bg-amber-400">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function TextWithLinks({ text, searchText, className }: { text: string; searchText?: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <div className={cn('wa-msg-text whitespace-pre-line', className)}>
      {lines.map((line, lineIdx) => {
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        const regex = new RegExp(URL_REGEX.source, 'g');
        while ((match = regex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            const textPart = line.slice(lastIndex, match.index);
            parts.push(
              <span key={`text-${lineIdx}-${lastIndex}`}>
                {highlightQuery(textPart, searchText)}
              </span>
            );
          }
          const url = match[0];
          parts.push(
            <a
              key={match.index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#68a4f6] hover:underline break-all"
            >
              {url}
            </a>
          );
          lastIndex = match.index + url.length;
        }
        if (lastIndex < line.length) {
          const textPart = line.slice(lastIndex);
          parts.push(
            <span key={`text-${lineIdx}-${lastIndex}`}>
              {highlightQuery(textPart, searchText)}
            </span>
          );
        }
        return <div key={lineIdx}>{parts.length > 0 ? parts : highlightQuery(line, searchText)}</div>;
      })}
    </div>
  );
}

function parseVCard(vcard: string) {
  const lines = vcard.split('\n');
  let name = '';
  let phone = '';

  for (const line of lines) {
    if (line.startsWith('FN:')) {
      name = line.substring(3).trim();
    } else if (line.startsWith('TEL;')) {
      const parts = line.split(':');
      if (parts.length > 1) {
        phone = parts[parts.length - 1].trim();
      }
    } else if (line.startsWith('TEL:')) {
      phone = line.substring(4).trim();
    }
  }

  return { name, phone };
}

// ── Timestamp overlay (WhatsApp image-only style) ──────────────────────────────
function MediaTimestampOverlay({
  timestamp,
  isOutgoing,
  status,
}: {
  timestamp: Date;
  isOutgoing: boolean;
  status: Message['status'];
}) {
  const StatusIcon = statusIcons[status];
  const isFailed = status === 'failed';
  return (
    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/45">
      <span className="text-[11px] text-white leading-none">{format(timestamp, 'h:mm a')}</span>
      {isOutgoing && StatusIcon && (
        <StatusIcon
          className={cn(
            'h-3 w-3',
            isFailed ? 'text-red-400' : status === 'read' ? 'text-[#53bdeb]' : 'text-white/80',
          )}
        />
      )}
    </div>
  );
}

// ── Inbound media renderer ────────────────────────────────────────────────────
function MediaCard({
  message,
  mediaId,
  mediaUrl,
  mediaType,
  mediaMimeType,
  mediaFilename,
  mediaCaption,
  fileBase64,
  contentType,
  channel,
  timestamp,
  isOutgoing,
  status,
  onMediaClick,
}: {
  message: Message;
  mediaId?: string;
  mediaUrl: string;
  mediaType: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaCaption?: string;
  fileBase64?: string;
  contentType?: string;
  channel?: 'waba' | 'personal';
  timestamp: Date;
  isOutgoing: boolean;
  status: Message['status'];
  onMediaClick?: (message: Message) => void;
}) {
  const effectiveMime = contentType || mediaMimeType || '';
  const isImage = mediaType === 'image' || mediaType === 'sticker' || effectiveMime.startsWith('image/');
  const isVideo = mediaType === 'video' || effectiveMime.startsWith('video/');
  const isAudio = mediaType === 'audio' || effectiveMime.startsWith('audio/');
  const hasCaption = Boolean(mediaCaption?.trim());
  const hasMediaSource = Boolean(mediaId || fileBase64 || mediaUrl);
  const canOpenViewer = Boolean(hasMediaSource && onMediaClick && (isImage || isVideo));

  const handleClick = () => {
    if (canOpenViewer) onMediaClick?.(message);
  };

  if (isImage) {
    // No media source available — render compact text instead of big grey box
    if (!hasMediaSource) {
      return (
        <div className="flex items-center gap-2 py-1 min-w-[160px] opacity-75">
          <ImageIcon className="w-4 h-4 shrink-0 opacity-60" />
          <span className="text-[13px] truncate max-w-[200px]">{mediaFilename || 'Image'}</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        <div
          className={cn(
            'relative overflow-hidden',
            hasCaption ? 'rounded-t-[5px]' : 'rounded-[5px]',
            canOpenViewer && 'cursor-pointer group/imgbubble',
          )}
          onClick={handleClick}
          role={canOpenViewer ? 'button' : undefined}
          tabIndex={canOpenViewer ? 0 : undefined}
          onKeyDown={(e) => { if (canOpenViewer && (e.key === 'Enter' || e.key === ' ')) handleClick(); }}
          aria-label={canOpenViewer ? 'Open image preview' : undefined}
        >
          <>
            <AuthenticatedMediaImage
              src={mediaUrl || undefined}
              mediaId={mediaId}
              fileBase64={fileBase64}
              contentType={contentType}
              channel={channel}
              alt={mediaCaption || mediaFilename || 'Photo'}
              className="block w-full max-w-[330px] min-w-[220px] max-h-[380px] object-cover"
            />
            {canOpenViewer && (
              <div className="absolute inset-0 bg-black/0 group-hover/imgbubble:bg-black/10 transition-colors pointer-events-none" />
            )}
          </>
          {!hasCaption && (
            <MediaTimestampOverlay timestamp={timestamp} isOutgoing={isOutgoing} status={status} />
          )}
        </div>
        {hasCaption && (
          <p className="text-[14.2px] wa-msg-text leading-snug pt-1.5 px-1 pb-0.5">{mediaCaption}</p>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="flex flex-col">
        <div
          className={cn('relative overflow-hidden', hasCaption ? 'rounded-t-[5px]' : 'rounded-[5px]', canOpenViewer && 'cursor-pointer')}
          onClick={handleClick}
        >
          {mediaUrl ? (
            <>
              <video
                src={mediaUrl}
                className="block w-full max-w-[330px] min-w-[200px] object-cover pointer-events-none"
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-6 bg-black/5 min-w-[200px]">
              <Video className="w-10 h-10 opacity-40 shrink-0" />
              <span className="text-[13px] opacity-70">{mediaFilename || 'Video'}</span>
            </div>
          )}
          {!hasCaption && (
            <MediaTimestampOverlay timestamp={timestamp} isOutgoing={isOutgoing} status={status} />
          )}
        </div>
        {hasCaption && (
          <p className="text-[14.2px] wa-msg-text leading-snug pt-1.5 px-1 pb-0.5">{mediaCaption}</p>
        )}
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex flex-col gap-1 min-w-[200px]">
        <div className="flex items-center gap-2 px-1 py-1">
          <Music className="w-4 h-4 shrink-0 opacity-70" />
          {mediaUrl ? (
            <audio src={mediaUrl} controls className="h-8 max-w-[220px]" />
          ) : (
            <span className="text-[13px] opacity-80">{mediaFilename || 'Audio'}</span>
          )}
        </div>
        {hasCaption && (
          <p className="text-[14.2px] wa-msg-text leading-snug px-0.5">{mediaCaption}</p>
        )}
      </div>
    );
  }

  const filename = mediaFilename || 'Document';
  const docBody = (
    <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-md bg-black/5 hover:bg-black/10 transition-colors min-w-[200px]">
      <FileText className="w-8 h-8 shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">{filename}</p>
        {mediaMimeType && <p className="text-[11px] opacity-60 truncate">{mediaMimeType}</p>}
      </div>
      {mediaUrl && <Download className="w-4 h-4 shrink-0 opacity-60" />}
    </div>
  );

  return (
    <div className="flex flex-col gap-0.5">
      {mediaUrl ? (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" download={filename} className="cursor-pointer">
          {docBody}
        </a>
      ) : docBody}
      {hasCaption && (
        <p className="text-[14.2px] wa-msg-text leading-snug pt-1 px-0.5">{mediaCaption}</p>
      )}
    </div>
  );
}

// ── Template message renderer ─────────────────────────────────────────────────
function TemplateMessageBubble({ content, templateName }: { content: string; templateName: string }) {
  const LABELS: Record<string, string> = {
    cohesion_report_no_interaction: 'Cohesion Report',
    member_121_recommendations:     '1-2-1 Recommendations',
    onboard_new_member:             'Welcome Message',
  };
  const label = LABELS[templateName]
    ?? templateName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex items-center gap-1.5 pb-1 border-b border-white/20">
        <MessageSquare className="w-3 h-3 opacity-70 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {label}
        </span>
      </div>
      <p className="wa-msg-text text-[13px] leading-snug whitespace-pre-line">{content}</p>
    </div>
  );
}

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  phone?: string;
  email?: string;
}

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  contact?: Contact;
  onAgentClick?: (agentId?: string) => void;
  onDeleteMessage?: (message: Message, scope: 'me' | 'everyone') => void;
  onMediaClick?: (message: Message) => void;
  searchText?: string;
  isHighlighted?: boolean;
  channel?: 'waba' | 'personal';
}

const statusIcons = {
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
  pending: Clock,
};

function AiAvatar() {
  const { isDark } = useTheme();
  return (
    <img
      src={isDark ? '/logo-white.svg' : '/logo.svg'}
      alt="Mr LAD"
      className="h-8 w-8 object-contain shrink-0"
    />
  );
}

function LeadAvatar({ contact }: { contact?: Contact }) {
  const initial = contact?.name ? contact.name.charAt(0).toUpperCase() : 'L';
  return (
    <Avatar className="flex-shrink-0 w-8 h-8">
      {contact?.avatar && <AvatarImage src={contact.avatar} alt={contact.name} />}
      <AvatarFallback className="text-xs font-semibold bg-emerald-100 text-emerald-700">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

function AgentAvatar({
  name,
  agentId,
  onClick,
}: {
  name?: string;
  agentId?: string;
  onClick?: (agentId?: string) => void;
}) {
  const initial = name ? name.charAt(0).toUpperCase() : 'H';
  return (
    <button
      className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold ring-1 ring-violet-200 hover:ring-violet-400 hover:bg-violet-200 transition-all cursor-pointer"
      onClick={() => onClick?.(agentId)}
      title={`${name || 'Human Agent'} — click to view profile`}
      aria-label="Open agent profile"
    >
      {initial}
    </button>
  );
}

function AgentProfilePopover({
  name,
  agentId,
  onClose,
  onViewAssignment,
}: {
  name?: string;
  agentId?: string;
  onClose: () => void;
  onViewAssignment?: () => void;
}) {
  const displayName = name || 'Human Agent';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className="absolute z-50 bottom-10 left-0 w-56 bg-popover border border-border rounded-xl shadow-lg p-3 text-sm"
      role="dialog"
      aria-label="Agent profile"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Human Agent
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold ring-1 ring-violet-200">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{displayName}</p>
          {agentId && (
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              ID: {agentId.substring(0, 8)}…
            </p>
          )}
        </div>
      </div>
      {onViewAssignment && (
        <button
          onClick={() => { onViewAssignment(); onClose(); }}
          className="w-full flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <UserCircle className="h-3.5 w-3.5" />
          View assignment details
        </button>
      )}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showAvatar = false,
  contact,
  onAgentClick,
  onDeleteMessage,
  onMediaClick,
  searchText,
  isHighlighted = false,
  channel = 'waba',
}: MessageBubbleProps) {
  const { content, timestamp, isOutgoing, status, sender, role } = message;
  const StatusIcon = statusIcons[status];
  const [showAgentProfile, setShowAgentProfile] = useState(false);
  const [contactModal, setContactModal] = useState<{ open: boolean; name: string; phone: string }>({ open: false, name: '', phone: '' });
  const [messageInfoModal, setMessageInfoModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [contactCardHovered, setContactCardHovered] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [showReactionPopup, setShowReactionPopup] = useState(false);

  const isAI = isOutgoing && role !== 'human_agent';
  const isLead = !isOutgoing;
  const isMedia = isMediaMessage(message);
  const mediaCaption = resolveMediaCaption(message);
  const isImageOrVideo = isImageMessage(message) || isVideoMessage(message);
  const showOverlayTimestamp = isMedia && isImageOrVideo && !mediaCaption;

  const handleAgentAvatarClick = (agentId?: string) => {
    if (onAgentClick) onAgentClick(agentId);
    else setShowAgentProfile((v) => !v);
  };

  return (
    <>
      <div className={cn('flex gap-2 group items-end', isOutgoing ? 'flex-row-reverse' : 'flex-row')}>
        {showAvatar && isLead && <LeadAvatar contact={contact} />}
        {showAvatar && isOutgoing && (
          <div className="relative">
            {isAI ? (
              <AiAvatar />
            ) : (
              <>
                <AgentAvatar
                  name={message.senderName || sender.name}
                  agentId={message.humanAgentId}
                  onClick={handleAgentAvatarClick}
                />
                {showAgentProfile && !onAgentClick && (
                  <AgentProfilePopover
                    name={message.senderName || sender.name}
                    agentId={message.humanAgentId}
                    onClose={() => setShowAgentProfile(false)}
                  />
                )}
              </>
            )}
          </div>
        )}

      <div
        className={cn(
          'shadow-sm flex flex-col transition-all duration-300 relative',
          isMedia && isImageOrVideo ? 'max-w-[340px] p-[3px]' : 'max-w-[72%] px-3 py-[6px]',
          isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming',
          isHighlighted && 'ring-2 ring-amber-500 dark:ring-amber-400 bg-amber-100/40 dark:bg-amber-500/25 scale-[1.02]',
        )}
      >
        {onDeleteMessage && (
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu open={contactDropdownOpen} onOpenChange={setContactDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 w-6 rounded-full bg-black/15 hover:bg-black/25 text-white/90 inline-flex items-center justify-center"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[rgb(22,23,23)] border-gray-200 dark:bg-[rgb(22,23,23)] border-[#182229] dark:border-[#182229] shadow-lg">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMessageInfoModal(true); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                  <Info className="h-4 w-4 mr-2" />
                  Message info
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowReactionPopup(true); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  React
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                  <Pin className="h-4 w-4 mr-2" />
                  Pin
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                  <Star className="h-4 w-4 mr-2" />
                  Star
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-[#182229]" />
                {isOutgoing && (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteMessage(message, 'me'); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                      Delete for me
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteMessage(message, 'everyone'); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                      Delete for everyone
                    </DropdownMenuItem>
                  </>
                )}
                {!isOutgoing && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteMessage(message, 'me'); setContactDropdownOpen(false); }} className="text-gray-900 dark:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-[#182229]">
                    Delete for me
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {(message as { quotedMessage?: { sender?: string; content?: string } }).quotedMessage && (
          <div
            className={cn(
              'mb-1.5 p-2 rounded-md border-l-[3px] border-[#68a4f6] text-[13px] relative overflow-hidden flex flex-col cursor-pointer',
              isOutgoing ? 'bg-[#1e3d2e]' : 'bg-[#242626]',
            )}
          >
            <span className="font-semibold text-[#68a4f6] mb-0.5">
              {(message as { quotedMessage?: { sender?: string } }).quotedMessage?.sender || 'You'}
            </span>
            <span className="text-[#a4a5a5] line-clamp-3 wa-msg-text">
              {(message as { quotedMessage?: { content?: string } }).quotedMessage?.content}
            </span>
          </div>
        )}

        {message.templateName ? (
          <TemplateMessageBubble content={content} templateName={message.templateName} />
        ) : isMedia && !(isOutgoing && status === 'failed' && !(message as { fileBase64?: string }).fileBase64) ? (
          <MediaCard
            message={message}
            mediaId={message.mediaId}
            mediaUrl={getMessageMediaUrl(message, channel)}
            mediaType={getMessageMediaType(message)}
            mediaMimeType={message.mediaMimeType}
            mediaFilename={message.mediaFilename || (
              /\.(png|jpe?g|gif|webp|mp4|pdf|docx?)$/i.test(content) ? content : undefined
            )}
            mediaCaption={mediaCaption}
            fileBase64={(message as { fileBase64?: string }).fileBase64}
            contentType={(message as { contentType?: string }).contentType}
            channel={channel}
            timestamp={timestamp}
            isOutgoing={isOutgoing}
            status={status}
            onMediaClick={onMediaClick}
          />
        ) : message.latitude != null && message.longitude != null ? (
          <div className="flex flex-col gap-3">
            <LocationCard
              latitude={message.latitude}
              longitude={message.longitude}
              name={message.locationName}
              address={message.locationAddress}
            />
            <TextWithLinks text={content} className="text-sm" />
          </div>
        ) : (() => {
          const isVCard = content?.trim().startsWith('BEGIN:VCARD');
          const isContactMsg =
            message.mediaType === 'contact' ||
            message.contactName ||
            message.contactPhone ||
            (message as any).contactEmail ||
            ['contact', 'contacts'].includes(String((message as any).type ?? '').toLowerCase()) ||
            isVCard;

          if (isContactMsg) {
            let cName = message.contactName
              || (message as any).contact_name
              || (message as any).contacts?.[0]?.name?.formatted_name
              || (message as any).contacts?.[0]?.name?.first_name
              || (message as any).contacts?.[0]?.name?.last_name;
            let cPhone = message.contactPhone
              || (message as any).contact_phone
              || (message as any).contacts?.[0]?.phones?.[0]?.phone;

            if (isVCard && content) {
              const parsed = parseVCard(content);
              if (!cName) cName = parsed.name;
              if (!cPhone) cPhone = parsed.phone;
            }

            // If contact name is still not found but content exists, use content as name
            // This handles cases where contact data is stored in the content field
            if (!cName && content && !isVCard) {
              cName = content;
            }

            // Use phone number as fallback if no name
            if (!cName) cName = cPhone || 'Unknown Contact';

            const handleSaveContact = () => {
              if (!cPhone) return;
              const vcardText = `BEGIN:VCARD\nVERSION:3.0\nFN:${cName}\nTEL;type=CELL:${cPhone}\nEND:VCARD`;
              const blob = new Blob([vcardText], { type: 'text/vcard' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${cName}.vcf`;
              a.click();
              URL.revokeObjectURL(url);
            };

            return (
              <div
                className={cn(
                  'rounded-lg overflow-hidden min-w-[280px] relative group',
                  isOutgoing
                    ? 'bg-[#dcf8c6] dark:bg-[#005c4b]'
                    : 'bg-[#ffffff] dark:bg-[#202c33]'
                )}
              >
                {/* Contact card content */}
                <div
                  onClick={() => {
                    console.log('Opening contact modal with:', { cName, cPhone });
                    setContactModal({ open: true, name: cName, phone: cPhone || '' });
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-[#2a3942] flex items-center justify-center shrink-0">
                      <UserCircle className="w-6 h-6 text-gray-600 dark:text-[#8696a0]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-[#e9edef]">
                        {cName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-gray-500 dark:text-[#8696a0]">
                        {format(timestamp, 'h:mm a')}
                      </span>
                      {isOutgoing && StatusIcon && (
                        <StatusIcon
                          className={cn(
                            'h-3 w-3',
                            status === 'read' ? 'text-[#53bdeb]' : status === 'failed' ? 'text-red-500' : 'text-[#667781] dark:text-[#8696a0]',
                          )}
                        />
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 dark:border-[#2a3942]" />

                  {/* Action buttons */}
                  {cPhone ? (
                    <div className="grid grid-cols-2 text-center text-xs font-medium py-2">
                      <a
                        href={`https://wa.me/${cPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#00a884] dark:text-[#00a884] hover:underline border-r border-gray-200 dark:border-[#2a3942]"
                      >
                        Message
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveContact();
                        }}
                        className="text-[#00a884] dark:text-[#00a884] hover:underline"
                      >
                        Save contact
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="text-[#00a884] dark:text-[#00a884] hover:underline text-xs font-medium"
                      >
                        Invite to WhatsApp
                      </button>
                    </div>
                  )}
                </div>

                {/* Reaction popup */}
                {showReactionPopup && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-[rgb(22,23,23)] rounded-full px-2 py-1 flex items-center gap-1 shadow-lg">
                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle emoji reaction
                          setShowReactionPopup(false);
                        }}
                        className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#182229] rounded-full transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open full emoji picker
                        setShowReactionPopup(false);
                      }}
                      className="h-8 w-8 flex items-center justify-center hover:bg-[#182229] dark:hover:bg-[#182229] rounded-full transition-colors text-gray-400"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // Plain-text fallback
          return (
            <TextWithLinks
              text={content || (isOutgoing && status === 'failed' ? '⚠ Message failed to send' : '')}
              searchText={searchText}
            />
          );
        })()}

        {!showOverlayTimestamp && (
          <div className={cn('flex items-center gap-1 mt-0.5 -mb-0.5', isOutgoing ? 'justify-end' : 'justify-start')}>
            <span className="wa-msg-time text-[#667781] dark:text-white/60">
              {format(timestamp, 'h:mm a')}
            </span>
            {isOutgoing && StatusIcon && (
              <StatusIcon
                className={cn(
                  'h-3 w-3',
                  status === 'read' ? 'text-[#53bdeb]' : status === 'failed' ? 'text-red-500' : 'text-[#667781] dark:text-[#8696a0]',
                )}
              />
            )}
          </div>
        )}
      </div>

      {/* Real WhatsApp-style red circular error icon for failed outgoing messages */}
      {isOutgoing && status === 'failed' && (
        <div className="flex-shrink-0 self-end mb-0.5" title="Failed to send">
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
            <AlertCircle className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}
    </div>

    {/* Contact details modal */}
    <Dialog open={contactModal.open} onOpenChange={(open) => setContactModal({ ...contactModal, open })}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-white dark:bg-[rgb(22,23,23)]" showCloseButton={false}>
        <DialogTitle className="sr-only">Contact Details</DialogTitle>
        <div className="flex flex-col">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e9edef]">Contact info</h2>
            <button
              onClick={() => setContactModal({ ...contactModal, open: false })}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Contact info */}
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-5xl shadow-lg">
              {contactModal.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-[#e9edef]">{contactModal.name || 'Unknown'}</h3>
              <p className="text-base text-gray-600 dark:text-[#8696a0]">{contactModal.phone || 'No phone number'}</p>
            </div>
          </div>

          {/* Action buttons */}
          {contactModal.phone && (
            <div className="p-4 pt-0 space-y-2">
              <a
                href={`https://wa.me/${contactModal.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-lg font-medium transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                Message
              </a>
              <button
                onClick={() => {
                  const vcardText = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactModal.name}\nTEL;type=CELL:${contactModal.phone}\nEND:VCARD`;
                  const blob = new Blob([vcardText], { type: 'text/vcard' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${contactModal.name}.vcf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-[#2a3942] hover:bg-gray-200 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] rounded-lg font-medium transition-colors"
              >
                <UserCircle className="w-5 h-5" />
                Save contact
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Message info modal */}
    <Dialog open={messageInfoModal} onOpenChange={setMessageInfoModal}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-white dark:bg-[rgb(22,23,23)]" showCloseButton={false}>
        <DialogTitle className="sr-only">Message Info</DialogTitle>
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e9edef]">Message info</h2>
            <button
              onClick={() => setMessageInfoModal(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-[#8696a0] text-sm">Sent</span>
              <span className="text-gray-900 dark:text-[#e9edef] text-sm">{format(timestamp, 'h:mm a')}</span>
            </div>
            {status === 'delivered' && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-[#8696a0] text-sm">Delivered</span>
                <span className="text-gray-900 dark:text-[#e9edef] text-sm">{format(timestamp, 'h:mm a')}</span>
              </div>
            )}
            {status === 'read' && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-[#8696a0] text-sm">Read</span>
                <span className="text-gray-900 dark:text-[#e9edef] text-sm">{format(timestamp, 'h:mm a')}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete confirmation modal */}
    <Dialog open={deleteConfirmModal} onOpenChange={setDeleteConfirmModal}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-white dark:bg-[rgb(22,23,23)]" showCloseButton={false}>
        <DialogTitle className="sr-only">Delete Message</DialogTitle>
        <div className="flex flex-col">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e9edef] mb-2">Delete message?</h2>
            <p className="text-gray-600 dark:text-[#8696a0] text-sm">This will delete the message for everyone.</p>
          </div>
          <div className="flex gap-2 p-4 pt-0">
            <button
              onClick={() => setDeleteConfirmModal(false)}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-[#2a3942] hover:bg-gray-200 dark:hover:bg-[#374045] text-gray-900 dark:text-[#e9edef] rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDeleteMessage?.(message, 'everyone');
                setDeleteConfirmModal(false);
              }}
              className="flex-1 px-4 py-2 bg-[#d5485d] hover:bg-[#e5395e] text-white rounded-lg font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
});
