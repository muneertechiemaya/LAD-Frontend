"use client";

import { useState, useCallback, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConversations, useConversationMessages } from '@lad/frontend-features/conversations';
import type { Conversation, Message } from '@/types/conversation';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { MessageList } from './MessageList';
import { ConversationContextPanel } from './ConversationContextPanel';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ── New imports needed for the rich New Chat overlay ──────────────────────────
import { TemplatePicker } from './TemplatePicker';
import { ImportLeadsDialog } from './ImportLeadsDialog';
import { ChatGroupManager, AddToGroupDropdown, type ChatGroup } from './ChatGroupManager';
import { CreateBroadcastGroupModal } from './CreateBroadcastGroupModal';

import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  X, Video, Phone, Ban, ThumbsDown, Trash2, Bot, User, Camera, Music, MapPin, BarChart2, Star as StarIcon,
  MoreHorizontal, Smile, Paperclip, Mic, Send, MessageSquare, MessageSquarePlus, CheckCheck,
  Search, PlusSquare, MoreVertical, ArrowLeft, Grip, UserPlus, Users, Plus, FileText, ChevronDown, ChevronLeft,
  Pencil, Image as ImageIcon, Star, Bell, Clock, Shield, Lock, Heart, List, MinusCircle, ChevronRight,
  Info, CheckSquare, BellOff, XCircle, Link, Calendar, ListChecks, LogOut, RefreshCw, LayoutTemplate,
  // ── New icons for sort/filter toolbar ──
  ArrowDownUp, EyeOff, Eye, Hash, Tag, Filter,
  // ── New icons for rich New Chat overlay ──
  Megaphone, Loader2, CheckCircle2,
} from 'lucide-react';

// ── Shared type for context status chips ────────────────────────────────────
interface ContextStatusOption {
  value: string;
  label: string;
  count: number;
}

/** Convert snake_case context_status → readable label */
function formatContextStatus(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tailwind classes per WABA conversation stage — mirrors the chip the older
 *  ConversationListItem renders so the new WhatsApp UI shows the same stages
 *  (greeting → info_gathering → booking_in_progress → booking_completed /
 *  cancelled, plus human). Keyed by the lowercased context_status. */
const WABA_STAGE_CHIP_COLORS: Record<string, string> = {
  greeting:            'bg-blue-50 text-blue-700 border-blue-200',
  info_gathering:      'bg-violet-50 text-violet-700 border-violet-200',
  booking_in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  booking_completed:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:           'bg-rose-50 text-rose-700 border-rose-200',
  human:               'bg-orange-50 text-orange-700 border-orange-200',
  // legacy values still present on older rows
  booked:              'bg-emerald-50 text-emerald-700 border-emerald-200',
  qualified:           'bg-violet-50 text-violet-700 border-violet-200',
  active:              'bg-violet-50 text-violet-700 border-violet-200',
};
const WABA_STAGE_CHIP_DEFAULT = 'bg-gray-50 text-gray-600 border-gray-200';

// ── Types ─────────────────────────────────────────────────────────────────────
type AgentType = 'human' | 'ai';

interface PendingFile {
  id: string;
  file: File;
  base64: string;
  previewUrl: string;
  mediaType: 'image' | 'video' | 'document' | 'audio';
}

interface RichMessagePayload {
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'location' | 'contact' | 'poll';
  content?: string;
  fileBase64?: string;
  filename?: string;
  contentType?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  contactName?: string;
  contactPhone?: string;
  pollQuestion?: string;
  pollOptions?: string[];
}

interface LabelLike {
  id?: string | number;
  label_id?: string | number;
}

interface SidebarErrorState {
  message: string;
}

type ConversationActionHandler = (id?: string) => void | Promise<void>;

interface WABAChatWindowProps {
  conversation: Conversation | null;
  onSendMessage: (payload: RichMessagePayload) => void | Promise<void>;
  onTogglePanel?: () => void;
  isPanelOpen?: boolean;
  onBack?: () => void;
  onDeleteChat?: ConversationActionHandler;
  onBlockChat?: ConversationActionHandler;
  onFavoriteChat?: ConversationActionHandler;
  onMuteChat?: ConversationActionHandler;
  onClearChat?: ConversationActionHandler;
  onCloseChat?: ConversationActionHandler;
  channel?: 'personal' | 'waba';
  conversationId?: string;
  owner?: string | null;
  backendChannel?: 'personal' | 'waba';
}

interface WABAContextPanelProps {
  conversation: Conversation | null;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function inferMediaType(file: File): PendingFile['mediaType'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function getConversationLeadId(conv: Conversation): string | undefined {
  const raw = conv as Conversation & { leadId?: string | number; lead_id?: string | number };
  return raw.leadId != null ? String(raw.leadId) : raw.lead_id != null ? String(raw.lead_id) : undefined;
}

function getConversationLastMessageTimestamp(conv: Conversation): string | Date | undefined {
  const raw = conv as Conversation & { lastMessage?: { timestamp?: string | Date } };
  return raw.lastMessage?.timestamp;
}

function getConversationContextStatus(conv: Conversation): string | undefined {
  const raw = conv as Conversation & { context_status?: string | null };
  return raw.context_status ?? conv.conversationState ?? undefined;
}

function getConversationLabelIds(conv: Conversation): string[] {
  const raw = conv as Conversation & { labels?: Array<string | LabelLike>; labelIds?: Array<string | number> };
  const labels = (raw.labels ?? []).map((label) => {
    if (typeof label === 'string') return label;
    if (label?.id != null) return String(label.id);
    if (label?.label_id != null) return String(label.label_id);
    return '';
  });
  const labelIds = (raw.labelIds ?? []).map(String);
  return [...labels, ...labelIds, ...(conv.tags ?? []).map(String)].filter(Boolean);
}

async function getApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return fallback;
}

function MessageTicks({ status }: { status?: string }) {
  const s = status || 'sent';

  if (s === 'read' || s === 'seen') {
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline-block shrink-0">
        <path d="M1 5.5L4.5 9L8 5.5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5.5L8.5 9L15 2" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  if (s === 'delivered') {
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline-block shrink-0">
        <path d="M1 5.5L4.5 9L8 5.5" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5.5L8.5 9L15 2" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  // 'sent' or 'pending' — single tick
  return (
    <svg width="12" height="11" viewBox="0 0 12 11" fill="none" className="inline-block shrink-0">
      <path d="M1 5.5L4.5 9L11 2" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────
const ATTACH_ITEMS = [
  { id: 'gallery', label: 'Photos & Video', icon: <ImageIcon className="w-6 h-6 text-white" />, bg: 'bg-purple-500' },
  { id: 'camera', label: 'Camera', icon: <Camera className="w-6 h-6 text-white" />, bg: 'bg-pink-500' },
  { id: 'document', label: 'Document', icon: <FileText className="w-6 h-6 text-white" />, bg: 'bg-blue-500' },
  { id: 'audio', label: 'Audio', icon: <Music className="w-6 h-6 text-white" />, bg: 'bg-orange-500' },
  { id: 'location', label: 'Location', icon: <MapPin className="w-6 h-6 text-white" />, bg: 'bg-green-500' },
  { id: 'contact', label: 'Contact', icon: <Phone className="w-6 h-6 text-white" />, bg: 'bg-teal-500' },
  { id: 'poll', label: 'Poll', icon: <BarChart2 className="w-6 h-6 text-white" />, bg: 'bg-[#0b1957]' },
  { id: 'sticker', label: 'Sticker', icon: <StarIcon className="w-6 h-6 text-white" />, bg: 'bg-yellow-500' },
  { id: 'event', label: 'Event', icon: <Calendar className="w-6 h-6 text-white" />, bg: 'bg-indigo-500' },
];

const STICKER_PACKS: Record<string, { label: string; emojis: string[] }> = {
  recently: { label: '⏰ Recent', emojis: ['😀', '😂', '❤️', '👍', '🔥', '💯', '✨', '🎉'] },
  smileys: { label: '😊 Smileys', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '😘', '😋', '😛', '😜', '😌', '😔', '😑', '😐', '😏', '😒', '😞', '😠', '😡', '🤬', '😈', '👿', '💀', '💩', '🤡'] },
  hearts: { label: '❤️ Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣️'] },
  gestures: { label: '👍 Gestures', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '✌️', '🤞', '👍', '👎', '☝️', '👆', '👇', '👈', '👉', '👏', '🙌', '🤝'] },
  animals: { label: '🐶 Animals', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🦆', '🦅', '🦉', '🐺', '🐴', '🦄', '🐝', '🦋', '🐌', '🐞', '🐜', '🐢', '🐍', '🦎', '🐙', '🐬', '🐳', '🦈'] },
  food: { label: '🍕 Food', emojis: ['🍏', '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥥', '🥑', '🍆', '🍅', '🌽', '🥐', '🍞', '🥚', '🍳', '🥞', '🍗', '🍔', '🍟', '🍕', '🥪', '🌮', '🌯', '🍝', '🍜', '🍛', '🍣', '🍤', '🎂', '🍰', '🧁', '🍩', '🍪', '🍫', '🍿', '🍦', '☕', '🍵', '🍺', '🥂'] },
  activities: { label: '⚽ Activities', emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎳', '🏓', '🏸', '⛳', '🎣', '🎿', '🏂', '🎯', '🎪', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '♟️', '🎭', '🎰', '🚗', '🏎️', '✈️', '🚁', '⛵', '🚤'] },
};

// ── Sub-modals ─────────────────────────────────────────────────────────────────
function PollModal({ onClose, onSend }: { onClose: () => void; onSend: (p: RichMessagePayload) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const addOption = () => options.length < 10 && setOptions([...options, '']);
  const updateOption = (i: number, v: string) => { const n = [...options]; n[i] = v; setOptions(n); };
  const removeOption = (i: number) => options.length > 2 && setOptions(options.filter((_, x) => x !== i));
  const handleSend = () => {
    const validOpts = options.filter(o => o.trim());
    if (!question.trim() || validOpts.length < 2) return;
    onSend({ type: 'poll', pollQuestion: question.trim(), pollOptions: validOpts });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0b1957] flex items-center justify-center"><BarChart2 className="w-4 h-4 text-white" /></div>
            <h3 className="font-semibold">Create Poll</h3>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Question</label>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question..."
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Options</label>
            <div className="mt-1 space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0b1957]/10 text-[#0b1957] text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                  <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                  {options.length > 2 && <button type="button" aria-label="Remove option" onClick={() => removeOption(i)}><X className="w-4 h-4 text-gray-300" /></button>}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button type="button" onClick={addOption} className="mt-2 text-xs text-[#0b1957] font-medium hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add option
              </button>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t flex gap-2 justify-end">
          <button type="button" onClick={handleSend} disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
            className="px-4 py-2 text-sm font-semibold bg-[#0b1957] text-white rounded-xl hover:bg-[#0a1540] disabled:opacity-40">
            Send Poll
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactModal({ onClose, onSend }: { onClose: () => void; onSend: (p: RichMessagePayload) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const handleSend = () => {
    if (!name.trim() || !phone.trim()) return;
    onSend({ type: 'contact', contactName: name.trim(), contactPhone: phone.trim() });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center"><Phone className="w-4 h-4 text-white" /></div>
            <h3 className="font-semibold">Share Contact</h3>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          {[{ label: 'Full Name *', value: name, set: setName, ph: 'John Doe' }, { label: 'Phone *', value: phone, set: setPhone, ph: '+971501234567' }].map(f => (
            <div key={f.label}>
              <label className="text-xs font-medium text-gray-500">{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t flex justify-end">
          <button type="button" onClick={handleSend} disabled={!name.trim() || !phone.trim()}
            className="px-4 py-2 text-sm font-semibold bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-40">
            Share Contact
          </button>
        </div>
      </div>
    </div>
  );
}

function EventModal({ onClose, onSend }: { onClose: () => void; onSend: (p: RichMessagePayload) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const handleSend = () => {
    if (!title.trim() || !date) return;
    let text = `📅 *Event: ${title.trim()}*\n🗓️ ${date}${time ? ' at ' + time : ''}`;
    onSend({ type: 'text', content: text });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center"><Calendar className="w-4 h-4 text-white" /></div>
            <h3 className="font-semibold">Share Event</h3>
          </div>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Event Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Team Meeting"
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="event-date" className="text-xs font-medium text-gray-500">Date *</label>
              <input id="event-date" type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
            </div>
            <div>
              <label htmlFor="event-time" className="text-xs font-medium text-gray-500">Time</label>
              <input id="event-time" type="time" value={time} onChange={e => setTime(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t flex justify-end">
          <button type="button" onClick={handleSend} disabled={!title.trim() || !date}
            className="px-4 py-2 text-sm font-semibold bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-40">
            Share Event
          </button>
        </div>
      </div>
    </div>
  );
}

function LocationModal({ onClose, onSend }: { onClose: () => void; onSend: (p: RichMessagePayload) => void }) {
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [manual, setManual] = useState('');
  const getLocation = () => {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus('done'); },
      () => setGpsStatus('error'),
      { timeout: 10000 }
    );
  };
  const handleSend = () => {
    if (coords) onSend({ type: 'location', latitude: coords.lat, longitude: coords.lng, locationName: 'My Location', locationAddress: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
    else if (manual.trim()) onSend({ type: 'location', locationName: manual.trim(), locationAddress: manual.trim(), latitude: 0, longitude: 0 });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><MapPin className="w-4 h-4 text-white" /></div>
            <h3 className="font-semibold">Share Location</h3>
          </div>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <button type="button" onClick={getLocation} disabled={gpsStatus === 'loading'}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-green-50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              {gpsStatus === 'loading' ? <Loader2 className="w-5 h-5 text-green-600 animate-spin" /> : <MapPin className="w-5 h-5 text-green-600" />}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">{gpsStatus === 'loading' ? 'Getting location…' : gpsStatus === 'done' ? '✓ Location found' : 'Send Current Location'}</p>
              {coords && <p className="text-xs text-gray-500">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
              {gpsStatus === 'error' && <p className="text-xs text-red-500">Location access denied</p>}
            </div>
          </button>
          <div>
            <label className="text-xs font-medium text-gray-500">Or enter address</label>
            <input value={manual} onChange={e => setManual(e.target.value)} placeholder="e.g. Dubai Mall, UAE"
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t flex justify-end">
          <button type="button" onClick={handleSend} disabled={!coords && !manual.trim()}
            className="px-4 py-2 text-sm font-semibold bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-40">
            Share Location
          </button>
        </div>
      </div>
    </div>
  );
}

function StickerPicker({ onSelect, onClose }: { onSelect: (s: string) => void; onClose: () => void }) {
  const [activePack, setActivePack] = useState('recently');
  const packs = Object.entries(STICKER_PACKS);
  const currentPack = STICKER_PACKS[activePack];
  return (
    <div className="fixed left-3 right-3 bottom-20 z-[10000] bg-white border border-gray-200 rounded-2xl shadow-xl w-auto max-h-[60vh] flex flex-col overflow-hidden lg:absolute lg:left-0 lg:right-auto lg:bottom-full lg:mb-2 lg:w-72 lg:max-h-[320px]">
      <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
        <span className="font-semibold text-sm">Stickers</span>
        <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="grid grid-cols-7 gap-1">
          {currentPack.emojis.map((emoji) => (
            <button
              type="button"
              key={emoji}
              onMouseDown={(e) => {
                // preventDefault stops the textarea from losing focus before setText fires
                e.preventDefault();
                onSelect(emoji);
              }}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="px-2 py-1.5 border-t flex items-center gap-1 overflow-x-auto shrink-0">
        {packs.map(([key, pack]) => (
          <button type="button" key={key} onClick={() => setActivePack(key)}
            className={cn('px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              activePack === key ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600')}>
            {pack.label.split(' ')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* WABAContextPanel                                                          */
/* ========================================================================= */

function WABAContextPanel({ conversation, onClose }: WABAContextPanelProps) {
  if (!conversation) return null;

  const mockImages = [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
  ];

  return (
    <div className="h-full flex flex-col bg-background dark:bg-[#161717] overflow-y-auto border-l border-border dark:border-[#222d34]/80">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-background dark:bg-[#161717] sticky top-0 z-10 border-b border-border dark:border-[#222d34]">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to chat"
            className="xl:hidden inline-flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-muted-foreground dark:text-white hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#202c33]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contact info"
            className="hidden xl:inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground dark:text-white hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#202c33]"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-normal text-[16px] text-foreground dark:text-white">Contact info</h2>
        </div>
        <Pencil className="w-5 h-5 cursor-pointer text-muted-foreground dark:text-white hover:text-foreground" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Profile Block */}
        <div className="flex flex-col items-center pt-6 pb-2">
          <Avatar className="w-[200px] h-[200px] mb-6 shadow-sm">
            <AvatarImage src={conversation.contact?.avatar} />
            <AvatarFallback className="text-6xl">{conversation.contact?.name?.[0]}</AvatarFallback>
          </Avatar>
          <h2 className="text-[24px] font-medium text-foreground dark:text-white mb-1">{conversation.contact?.name}</h2>
          <span className="text-[16px] text-muted-foreground dark:text-[#a2a2a2] mb-6">+91 9998887770</span>

          <div className="flex gap-4 mb-4">
            <div className="w-[100px] h-[72px] border border-border dark:border-[#222d34] rounded-[16px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
              <Search className="w-5 h-5 text-[#00a884] mb-1.5" />
              <span className="text-[14px] text-foreground dark:text-white">Search</span>
            </div>
          </div>
        </div>

        <div className="px-6 mb-4 mt-2">
          <span className="text-[14px] text-muted-foreground dark:text-[#a2a2a2] font-medium">About</span>
        </div>

        <div className="h-[1px] bg-border dark:bg-[#222d34] mx-6 my-2" />

        {/* Media */}
        <div className="py-2">
          <div className="flex items-center justify-between px-6 mb-4 cursor-pointer">
            <div className="flex items-center gap-4">
              <ImageIcon className="w-5 h-5 text-muted-foreground dark:text-white" />
              <h4 className="text-[15px] font-normal text-foreground dark:text-white">Media, links and docs</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-muted-foreground dark:text-[#a2a2a2]">26</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground dark:text-white" />
            </div>
          </div>
          <div className="flex gap-2 px-6 overflow-x-auto no-scrollbar">
            {mockImages.map((src, i) => (
              <div key={i} className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden cursor-pointer">
                <img src={src} className="w-full h-full object-cover" alt="media" />
              </div>
            ))}
          </div>
        </div>

        <div className="h-[1px] bg-border dark:bg-[#222d34] mx-6 my-4" />

        {/* Settings 1 */}
        <div className="py-2">
          <div className="flex items-center px-6 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
            <Star className="w-5 h-5 text-muted-foreground dark:text-white mr-6" />
            <span className="text-[16px] text-foreground dark:text-white flex-1">Starred messages</span>
          </div>
          <div className="flex items-center px-6 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
            <Bell className="w-5 h-5 text-muted-foreground dark:text-white mr-6" />
            <span className="text-[16px] text-foreground dark:text-white flex-1">Mute notifications</span>
            <Switch />
          </div>
          <div className="flex items-center px-6 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
            <Clock className="w-5 h-5 text-muted-foreground dark:text-white mr-6" />
            <div className="flex-1">
              <span className="text-[16px] text-foreground dark:text-white block">Disappearing messages</span>
              <span className="text-[14px] text-muted-foreground dark:text-[#a2a2a2] mt-0.5 block">Off</span>
            </div>
          </div>
          <div className="flex items-center px-6 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
            <Shield className="w-5 h-5 text-muted-foreground dark:text-white mr-6" />
            <div className="flex-1">
              <span className="text-[16px] text-foreground dark:text-white block">Advanced chat privacy</span>
              <span className="text-[14px] text-muted-foreground dark:text-[#a2a2a2] mt-0.5 block">Off</span>
            </div>
          </div>
          <div className="flex items-center px-6 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
            <Lock className="w-5 h-5 text-muted-foreground dark:text-white mr-6" />
            <div className="flex-1">
              <span className="text-[16px] text-foreground dark:text-white block">Encryption</span>
              <span className="text-[14px] text-muted-foreground dark:text-[#a2a2a2] mt-0.5 block">Messages are end-to-end encrypted. Click to verify.</span>
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-border dark:bg-[#222d34] mx-6 my-2" />

        {/* Settings 2 */}
        <div className="py-2">
          <div className="flex items-center px-6 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
            <Heart className="w-5 h-5 text-muted-foreground dark:text-white mr-6" />
            <span className="text-[16px] text-foreground dark:text-white flex-1">Add to favourites</span>
          </div>
          <div className="flex items-center px-6 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] transition-colors">
            <List className="w-5 h-5 text-muted-foreground dark:text-white mr-6" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-[16px] text-foreground dark:text-white">Add to list</span>
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-border dark:bg-[#222d34] mx-6 my-2" />

        {/* Actions */}
        <div className="py-2 px-4 space-y-2">
          <div className="flex items-center px-4 py-3 rounded-2xl cursor-pointer bg-[#2a171b] hover:bg-[#351e23] transition-colors text-[#f15c6d]">
            <MinusCircle className="w-5 h-5 mr-4" />
            <span className="text-[16px]">Clear chat</span>
          </div>
          <div className="flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] rounded-2xl transition-colors text-[#f15c6d]">
            <Ban className="w-5 h-5 mr-4" />
            <div className="flex-1">
              <span className="text-[16px] block">Block</span>
              <span className="text-[14px] opacity-80 mt-0.5 block">{conversation.contact?.name?.split(' ')[0] || 'Home'}</span>
            </div>
          </div>
          <div className="flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] rounded-2xl transition-colors text-[#f15c6d]">
            <ThumbsDown className="w-5 h-5 mr-4" />
            <div className="flex-1">
              <span className="text-[16px] block">Report</span>
              <span className="text-[14px] opacity-80 mt-0.5 block">{conversation.contact?.name?.split(' ')[0] || 'Home'}</span>
            </div>
          </div>
          <div className="flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-[#202c33] rounded-2xl transition-colors text-[#f15c6d]">
            <Trash2 className="w-5 h-5 mr-4" />
            <span className="text-[16px]">Delete chat</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* WABAChatWindow                                                            */
/* ========================================================================= */

function dedupeById(msgs: Message[]): Message[] {
  const seen = new Map<string, Message>();
  for (const m of msgs) seen.set(m.id, m);
  return Array.from(seen.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

const INITIAL_LIMIT = 50;
const LOAD_MORE_LIMIT = 100;
const MAX_OLDER_MESSAGES = 500;
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

function WABAChatWindow({
  conversation,
  onSendMessage,
  onTogglePanel,
  isPanelOpen,
  onBack,
  onDeleteChat,
  onBlockChat,
  onFavoriteChat,
  onMuteChat,
  onClearChat,
  onCloseChat,
  channel,
  conversationId,
  owner,
  backendChannel,
}: WABAChatWindowProps) {
  const [text, setText] = useState('');
  const [agentType, setAgentType] = useState<AgentType>(owner === 'human_agent' ? 'human' : 'ai');
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [templateSending, setTemplateSending] = useState(false);
  const [templateSendProgress, setTemplateSendProgress] = useState<{ sent: number; total: number; running: boolean } | null>(null);
  const [templateSendResult, setTemplateSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipUpdating, setOwnershipUpdating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingFilesRef = useRef<PendingFile[]>([]);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const attachBtnRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [deletedForMeIds, setDeletedForMeIds] = useState<Set<string>>(new Set());
  const [deletedForEveryoneIds, setDeletedForEveryoneIds] = useState<Set<string>>(new Set());

  const { messages: polledMessages, isLoading, total, isAgentTyping } = useConversationMessages(
    conversation?.id || null,
    { limit: INITIAL_LIMIT },
    channel || 'waba'
  );

  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderOffset, setOlderOffset] = useState(INITIAL_LIMIT);

  const prevConvId = useRef<string | null>(null);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
      pendingFilesRef.current = [];
    };
  }, []);

  // Sync owner → agentType
  useEffect(() => {
    setAgentType(owner === 'human_agent' ? 'human' : 'ai');
  }, [owner, conversationId]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`; }
  }, [text]);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const h = (e: MouseEvent) => {
      if (attachBtnRef.current && !attachBtnRef.current.contains(e.target as Node))
        setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showAttachMenu]);

  useEffect(() => {
    if (conversation?.id && conversation.id !== prevConvId.current) {
      prevConvId.current = conversation.id;
      setPendingFiles((prev) => {
        prev.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
        return [];
      });
      setText('');
      setSendError(null);
      setOwnershipError(null);
      setOlderMessages([]);
      setOlderOffset(INITIAL_LIMIT);
      setDeletedForMeIds(new Set());
      setDeletedForEveryoneIds(new Set());
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (!showStickers) return;
    const h = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sticker-picker]') && !target.closest('[data-sticker-btn]'))
        setShowStickers(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showStickers]);

  const normalizeStatus = (s: string | undefined): string => {
  if (!s) return 'sent';
  if (s === 'read' || s === 'seen') return 'read';
  if (s === 'delivered' || s === 'delivered_to_device') return 'delivered';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'received') return 'sent'; // incoming messages treated as sent on display
  return 'sent';
};

const normalizedPolledMessages = polledMessages.map((m) => ({
  ...m,
  status: normalizeStatus(
    (m as Message & { message_status?: string }).status ||
    (m as Message & { message_status?: string }).message_status
  ),
}));

const baseMessages = dedupeById([...olderMessages, ...normalizedPolledMessages]);
const allMessages = useMemo(
  () =>
    baseMessages
      .filter((m) => !deletedForMeIds.has(m.id))
      .map((m) => {
        if (!deletedForEveryoneIds.has(m.id)) return m;
        return {
          ...m,
          content: m.isOutgoing ? 'You deleted this message' : 'This message was deleted',
          mediaId: undefined,
          mediaType: undefined,
          mediaMimeType: undefined,
          mediaFilename: undefined,
          mediaCaption: undefined,
          templateName: undefined,
          latitude: undefined,
          longitude: undefined,
          locationName: undefined,
          locationAddress: undefined,
        } as Message;
      }),
  [baseMessages, deletedForMeIds, deletedForEveryoneIds]
);
  const hasMore = total > olderOffset;

  const matchingMessageIds = useMemo(() => {
    if (!searchText.trim()) return [];
    return allMessages
      .filter((m) => m.content?.toLowerCase().includes(searchText.toLowerCase()))
      .map((m) => m.id);
  }, [allMessages, searchText]);

  const totalMatches = matchingMessageIds.length;

  const handleSearchNext = () => setSearchMatchIndex((prev) => (prev + 1) % totalMatches);
  const handleSearchPrev = () => setSearchMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);

  const handleLoadMore = useCallback(async () => {
    if (loadingOlder || !conversation?.id || !hasMore) return;
    setLoadingOlder(true);
    try {
      const url =
        `/api/whatsapp-conversations/conversations/${conversation.id}/messages` +
        `?limit=${LOAD_MORE_LIMIT}&offset=${olderOffset}&channel=${channel || 'waba'}`;
      const res = await fetchWithTenant(url);
      if (!res.ok) return;
      const data = await res.json();
      const raw = (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.messages) ? data.messages : [])) as Array<Record<string, unknown>>;

      const mapped: Message[] = raw.map((r) => {
        const rawRole = r.role || 'user';
        const rawType = String(r.type || '').toLowerCase();
        const inferredMediaTypeFromRawType =
          rawType === 'image' || rawType === 'video' || rawType === 'audio' || rawType === 'document'
            ? rawType
            : undefined;
        const meta =
          typeof r.metadata === 'string'
            ? (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })()
            : r.metadata || {};
        const role =
          meta.sender_type === 'human_agent' && rawRole === 'assistant' ? 'human_agent' : rawRole;
        const isOutgoing = role === 'assistant' || role === 'AI' || role === 'human_agent';
        return {
          id: r.id,
          conversationId: r.conversation_id,
          content: r.content || '',
          timestamp: new Date(r.created_at),
          isOutgoing,
          status: (() => {
            const s = r.message_status || r.status || '';
            if (s === 'read' || s === 'seen') return 'read';
            if (s === 'delivered' || s === 'delivered_to_device') return 'delivered';
            if (s === 'failed' || s === 'error') return 'failed';
            return 'sent'; // covers 'sent', 'pending', '' etc.
          })(),
          sender: {
            id: isOutgoing ? meta.human_agent_id || 'agent' : r.lead_id || 'user',
            name: isOutgoing ? (role === 'human_agent' ? meta.sender_name || 'Agent' : 'AI Agent') : 'Contact',
          },
          role,
          senderName: role === 'human_agent' ? meta.sender_name || undefined : undefined,
          humanAgentId: meta.human_agent_id || undefined,
          templateName: meta.template_name || r.template_name || undefined,
          latitude: meta.latitude !== undefined
            ? Number(meta.latitude)
            : (r.latitude !== undefined ? Number(r.latitude) : undefined),
          longitude: meta.longitude !== undefined
            ? Number(meta.longitude)
            : (r.longitude !== undefined ? Number(r.longitude) : undefined),
          locationName: meta.location_name || r.location_name || undefined,
          locationAddress: meta.location_address || r.location_address || undefined,
          mediaId: meta.media_id || r.media_id || r.mediaId || r.file_url || r.url || undefined,
          mediaType: meta.message_type || meta.media_type || r.message_type || r.media_type || r.mediaType || inferredMediaTypeFromRawType || undefined,
          mediaMimeType: meta.mime_type || r.mime_type || r.content_type || r.media_mime_type || undefined,
          mediaFilename: meta.filename || r.filename || r.media_filename || undefined,
          mediaCaption: meta.caption || r.caption || undefined,
        } as Message;
      });

      setOlderMessages((prev) => dedupeById([...mapped, ...prev]).slice(-MAX_OLDER_MESSAGES));
      const nextOffsetIncrement = raw.length > 0 ? raw.length : LOAD_MORE_LIMIT;
      setOlderOffset((prev) => prev + nextOffsetIncrement);
    } catch (err: unknown) {
      setSendError(getErrorMessage(err, 'Failed to load older messages'));
    } finally {
      setLoadingOlder(false);
    }
  }, [conversation?.id, loadingOlder, hasMore, olderOffset]);

  // ── Ownership ──────────────────────────────────────────────────────────────
  const updateOwnership = useCallback(async (newOwner: 'AI' | 'human_agent') => {
    const convId = conversationId || conversation?.id;
    if (!convId) return;
    const res = await fetchWithTenant(`/api/whatsapp-conversations/conversations/${convId}/ownership`, {
      method: 'PATCH',
      body: JSON.stringify({ owner: newOwner }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to update ownership (${res.status})`);
    }
  }, [conversationId, conversation?.id]);

  const handleAgentTypeChange = useCallback(async (type: AgentType) => {
    if (ownershipUpdating || type === agentType) return;
    setOwnershipError(null);
    if (type === 'human' && agentType === 'ai') setShowTakeoverDialog(true);
    else if (type === 'ai' && agentType === 'human') {
      setOwnershipUpdating(true);
      try {
        await updateOwnership('AI');
        setAgentType('ai');
      } catch (err: unknown) {
        setOwnershipError(getErrorMessage(err, 'Failed to return control to AI'));
      } finally {
        setOwnershipUpdating(false);
      }
    }
  }, [agentType, ownershipUpdating, updateOwnership]);

  const confirmTakeover = useCallback(async () => {
    if (ownershipUpdating) return;
    setOwnershipUpdating(true);
    setOwnershipError(null);
    try {
      await updateOwnership('human_agent');
      setAgentType('human');
      setShowTakeoverDialog(false);
    } catch (err: unknown) {
      setOwnershipError(getErrorMessage(err, 'Failed to take over from AI'));
    } finally {
      setOwnershipUpdating(false);
    }
  }, [ownershipUpdating, updateOwnership]);

  // ── File handling ──────────────────────────────────────────────────────────
  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFileLoading(true);
    const additions: PendingFile[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          throw new Error(`${file.name} is larger than 16 MB`);
        }
        const base64 = await readFileAsBase64(file);
        additions.push({
          id: `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file, base64,
          previewUrl: URL.createObjectURL(file),
          mediaType: inferMediaType(file),
        });
      }
      setPendingFiles(prev => [...prev, ...additions]);
      setSendError(null);
    } catch (err: unknown) {
      additions.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
      setSendError(getErrorMessage(err, 'Failed to read attachment'));
    } finally {
      setFileLoading(false);
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles(prev => {
      const removed = prev.find(p => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (isSending) return;
    setSendError(null);
    if (pendingFiles.length > 0) {
      setIsSending(true);
      const sentIds = new Set<string>();
      try {
        for (const pf of pendingFiles) {
          await Promise.resolve(onSendMessage({
            type: pf.mediaType,
            fileBase64: pf.base64,
            filename: pf.file.name,
            contentType: pf.file.type,
            caption: text.trim() || undefined,
          }));
          sentIds.add(pf.id);
          URL.revokeObjectURL(pf.previewUrl);
        }
        setPendingFiles([]);
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      } catch (err: unknown) {
        if (sentIds.size > 0) {
          setPendingFiles((prev) => prev.filter((pf) => !sentIds.has(pf.id)));
        }
        setSendError(getErrorMessage(err, 'Failed to send attachment'));
      } finally {
        setIsSending(false);
      }
      return;
    }
    if (!text.trim()) return;
    setIsSending(true);
    try {
      await Promise.resolve(onSendMessage({ type: 'text', content: text.trim() }));
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err: unknown) {
      setSendError(getErrorMessage(err, 'Failed to send message'));
    } finally {
      setIsSending(false);
    }
  }, [isSending, pendingFiles, text, onSendMessage]);

  const handleRichSend = useCallback(async (payload: RichMessagePayload) => {
    setSendError(null);
    setIsSending(true);
    try {
      await Promise.resolve(onSendMessage(payload));
    } catch (err: unknown) {
      setSendError(getErrorMessage(err, 'Failed to send message'));
      return;
    } finally {
      setIsSending(false);
    }
    setShowPoll(false); setShowContact(false); setShowEvent(false); setShowLocation(false);
  }, [onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSend();
    }
    // Shift+Enter: do nothing — browser inserts \n naturally
  }, [handleSend]);

  const handleAttachItem = useCallback((id: string) => {
    setShowAttachMenu(false);
    switch (id) {
      case 'gallery': galleryRef.current?.click(); break;
      case 'camera': cameraRef.current?.click(); break;
      case 'document': documentRef.current?.click(); break;
      case 'audio': audioRef.current?.click(); break;
      case 'location': setShowLocation(true); break;
      case 'contact': setShowContact(true); break;
      case 'poll': setShowPoll(true); break;
      case 'sticker': setShowStickers(true); break;
      case 'event': setShowEvent(true); break;
    }
  }, []);

  const handleDeleteMessage = useCallback(
    async (message: Message, scope: 'me' | 'everyone') => {
      if (scope === 'me') {
        setDeletedForMeIds((prev) => new Set(prev).add(message.id));
        return;
      }

      const convId = conversationId || conversation?.id;
      if (!convId) return;

      setDeletedForEveryoneIds((prev) => new Set(prev).add(message.id));
      try {
        const selectedChannel = backendChannel || channel || 'waba';
        const res = await fetchWithTenant(
          `/api/whatsapp-conversations/conversations/${convId}/messages/${message.id}?channel=${selectedChannel}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delete_for_everyone: true }),
          }
        );
        if (!res.ok) throw new Error('Delete failed');
      } catch {
        setDeletedForEveryoneIds((prev) => {
          const next = new Set(prev);
          next.delete(message.id);
          return next;
        });
        setSendError('Could not delete for everyone');
      }
    },
    [backendChannel, channel, conversationId, conversation?.id]
  );

  // ── Template send ──────────────────────────────────────────────────────────
  const handleTemplateSend = useCallback(async (
    templateName: string, languageCode: string, parameters: string[],
    _nameFormat: 'first' | 'full', _batch: { batchSize?: number; delayMin?: number; delayRandom?: number; dailyLimit?: number },
    headerParamCount: number, headerType: string, headerUrl: string,
  ) => {
    const convId = conversationId || conversation?.id;
    if (!convId) return;
    setTemplateSending(true);
    setTemplateSendResult(null);
    setTemplateSendProgress({ sent: 0, total: 1, running: true });
    try {
      const res = await fetchWithTenant(
        `/api/whatsapp-conversations/conversations/bulk?channel=${backendChannel || channel || 'waba'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-template',
            conversation_ids: [convId],
            template_name: templateName,
            language_code: languageCode,
            parameters: parameters || [],
            header_param_count: headerParamCount ?? 0,
            header_type: headerType || '',
            header_url: headerUrl || '',
          }),
        }
      );
      const data = await res.json();
      setTemplateSendProgress({ sent: data.sent || 1, total: 1, running: false });
      if (!data.success) throw new Error(data.error || 'Failed');
      setTemplateSendResult({ success: true, message: `Template "${templateName}" sent` });
      setTimeout(() => setIsTemplatePickerOpen(false), 500);
      setTimeout(() => setTemplateSendResult(null), 3000);
    } catch (err: unknown) {
      setTemplateSendResult({ success: false, message: getErrorMessage(err, 'Failed to send template') });
      setTemplateSendProgress(null);
    } finally {
      setTemplateSending(false);
    }
  }, [conversationId, conversation?.id, backendChannel, channel]);

    if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35] border-l border-border dark:border-[#222d34]">
        <div className="bg-white dark:bg-[#111b21] p-8 rounded-2xl max-w-sm w-full flex flex-col items-center text-center shadow-sm">
          <div className="mb-6 relative">
            <div className="w-32 h-24 relative flex items-center justify-center">
              <svg viewBox="0 0 200 150" className="w-full h-full text-[#00a884]">
                <path d="M40 120 L160 120 C165 120 170 115 170 110 L170 40 C170 35 165 30 160 30 L40 30 C35 30 30 35 30 40 L30 110 C30 115 35 120 40 120 Z" fill="#e9edef" />
                <rect x="35" y="35" width="130" height="80" fill="#202c33" />
                <path d="M20 125 L180 125 C185 125 185 130 180 130 L20 130 C15 130 15 125 20 125 Z" fill="#d1d7db" />
                <rect x="40" y="40" width="120" height="70" fill="#00a884" />
                <rect x="50" y="50" width="40" height="10" rx="2" fill="#fff" opacity="0.9" />
                <rect x="110" y="70" width="40" height="10" rx="2" fill="#dcf8c6" />
              </svg>
            </div>
          </div>
          <h2 className="text-[19px] font-normal text-foreground dark:text-[#e9edef] mb-2">Download WhatsApp for Mac</h2>
          <p className="text-[13px] text-muted-foreground dark:text-[#8696a0] mb-8 leading-5">
            Make calls and get a faster experience when you download the Mac app.
          </p>
          <button type="button" className="bg-[#00a884] hover:bg-[#008f6f] text-white dark:text-[#111b21] font-medium text-[13px] px-6 py-2.5 rounded-full transition-colors">
            Get from App Store
          </button>
        </div>

        <div className="flex gap-6 mt-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white dark:bg-[#111b21] rounded-2xl flex items-center justify-center shadow-sm cursor-pointer hover:bg-muted dark:hover:bg-[#202c33]">
              <FileText className="w-6 h-6 text-muted-foreground dark:text-[#8696a0]" />
            </div>
            <span className="text-[13px] text-muted-foreground dark:text-[#8696a0]">Send document</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white dark:bg-[#111b21] rounded-2xl flex items-center justify-center shadow-sm cursor-pointer hover:bg-muted dark:hover:bg-[#202c33]">
              <UserPlus className="w-6 h-6 text-muted-foreground dark:text-[#8696a0]" />
            </div>
            <span className="text-[13px] text-muted-foreground dark:text-[#8696a0]">Add contact</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-white dark:bg-[#111b21] rounded-2xl flex items-center justify-center shadow-sm cursor-pointer hover:bg-muted dark:hover:bg-[#202c33]">
              <svg className="w-6 h-6 text-muted-foreground dark:text-[#8696a0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
            </div>
            <span className="text-[13px] text-muted-foreground dark:text-[#8696a0]">Ask Meta AI</span>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#161717] border-l border-border dark:border-[#222d34] relative">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none z-0 bg-repeat opacity-[0.4] dark:opacity-[0.06]"
        style={{ backgroundImage: 'url("/assets/wa-dark-bg.png")' }}
      />
      {/* Header */}
      <div className="h-[60px] px-4 flex items-center justify-between bg-white dark:bg-[#161717] shrink-0 z-10 relative">
        {isSearchOpen ? (
          <div className="flex items-center gap-3 w-full">
            <button type="button" onClick={() => { setIsSearchOpen(false); setSearchText(''); setSearchMatchIndex(0); }}>
              <X className="w-5 h-5 text-muted-foreground dark:text-white" />
            </button>
            <input
              autoFocus
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setSearchMatchIndex(0); }}
              placeholder="Search messages..."
              className="flex-1 bg-transparent border-b border-[#00a884] text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-[#8696a0] text-[15px] focus:outline-none pb-1"
            />
            {searchText && (
              <div className="flex items-center gap-2 text-muted-foreground dark:text-[#8696a0] text-[13px] shrink-0">
                <span>{totalMatches === 0 ? '0/0' : `${searchMatchIndex + 1}/${totalMatches}`}</span>
                <button type="button" aria-label="Previous match" onClick={handleSearchPrev} disabled={totalMatches === 0} className="hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronDown className="w-4 h-4 rotate-180" />
                </button>
                <button type="button" aria-label="Next match" onClick={handleSearchNext} disabled={totalMatches === 0} className="hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {/* Back button — visible only on mobile, matches LinkedIn style exactly */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8 -ml-1 text-muted-foreground dark:text-white"
                onClick={onBack}
                aria-label="Back to conversations"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 cursor-pointer" onClick={onTogglePanel}>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={conversation.contact?.avatar} />
                  <AvatarFallback>{conversation.contact?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-[16px] text-foreground dark:text-white">{conversation.contact?.name}</h3>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5 text-muted-foreground dark:text-white">
              <Search className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" onClick={() => setIsSearchOpen(true)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <MoreVertical className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[#161717] border border-border dark:border-0 shadow-lg text-foreground dark:text-[#d1d7db] py-2">
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4" onClick={onTogglePanel}>
                    <Info className="w-4 h-4" /> <span>Contact info</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4" onClick={() => setIsSearchOpen(true)}>
                    <Search className="w-4 h-4" /> <span>Search</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                    <CheckSquare className="w-4 h-4" /> <span>Select messages</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex justify-between group" onClick={() => onMuteChat?.(conversation?.id)}>
                    <div className="flex items-center gap-4"><BellOff className="w-4 h-4" /> <span>Mute notifications</span></div>
                    <ChevronRight className="w-4 h-4" />
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                    <Clock className="w-4 h-4" /> <span>Disappearing messages</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4" onClick={() => onFavoriteChat?.(conversation?.id)}>
                    <Heart className="w-4 h-4" /> <span>Add to favourites</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                    <List className="w-4 h-4" /> <span>Add to list</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4" onClick={() => onCloseChat?.(conversation?.id)}>
                    <XCircle className="w-4 h-4" /> <span>Close chat</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                    <Link className="w-4 h-4" /> <span>Send call link</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                    <Calendar className="w-4 h-4" /> <span>Schedule call</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                    <ThumbsDown className="w-4 h-4" /> <span>Report</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4" onClick={() => onBlockChat?.(conversation?.id)}>
                    <Ban className="w-4 h-4" /> <span>Block</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4" onClick={() => onClearChat?.(conversation?.id)}>
                    <MinusCircle className="w-4 h-4" /> <span>Clear chat</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-accent dark:focus:bg-[#182229] focus:text-white dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4" onClick={() => onDeleteChat?.(conversation?.id)}>
                    <Trash2 className="w-4 h-4" /> <span>Delete chat</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <MessageList
        messages={allMessages}
        conversationId={conversation.id}
        contact={conversation.contact}
        onDeleteMessage={handleDeleteMessage}
        isAgentTyping={isAgentTyping}
        hasMore={hasMore}
        isLoadingMore={loadingOlder}
        onLoadMore={handleLoadMore}
        searchText={searchText}
        highlightedMessageId={matchingMessageIds[searchMatchIndex]}
      />

      {/* ── Modals ── */}
      <AlertDialog open={showTakeoverDialog} onOpenChange={setShowTakeoverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take over from AI Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will pause the AI agent and give you manual control.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTakeover}>Yes, take control</AlertDialogAction>
          </AlertDialogFooter>
          {ownershipError && (
            <p className="px-6 pb-4 text-sm text-red-600">{ownershipError}</p>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {showPoll && <PollModal onClose={() => setShowPoll(false)} onSend={handleRichSend} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} onSend={handleRichSend} />}
      {showEvent && <EventModal onClose={() => setShowEvent(false)} onSend={handleRichSend} />}
      {showLocation && <LocationModal onClose={() => setShowLocation(false)} onSend={handleRichSend} />}

      {/* ── Hidden file inputs ── */}
      <input ref={galleryRef} type="file" multiple className="hidden" aria-label="Upload photos or videos" onChange={handleFileChange} accept="image/*,video/*" />
      <input ref={cameraRef} type="file" className="hidden" aria-label="Take a photo" onChange={handleFileChange} accept="image/*,video/*" />
      <input ref={documentRef} type="file" multiple className="hidden" aria-label="Upload document" onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" />
      <input ref={audioRef} type="file" multiple className="hidden" aria-label="Upload audio" onChange={handleFileChange} accept="audio/*" />

      {/* ── Template Picker ── */}
      <TemplatePicker
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        selectedCount={1}
        onSend={handleTemplateSend}
        sending={templateSending}
        sendProgress={templateSendProgress}
        channel={backendChannel ?? 'waba'}
        isBulkSend={false}
      />

      {/* Composer */}
      <div className="p-3 px-4 bg-white dark:bg-[#161717] shrink-0 z-10 relative">

        {/* ── Pending file previews ── */}
        {(pendingFiles.length > 0 || fileLoading) && (
          <div className="flex flex-wrap gap-2 mb-2">
            {fileLoading && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Reading file…</span>
              </div>
            )}
            {pendingFiles.map(pf => (
              <div key={pf.id} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 text-sm max-w-[200px]">
                {pf.mediaType === 'image'
                  ? <img src={pf.previewUrl} alt={pf.file.name} className="h-7 w-7 rounded object-cover shrink-0" />
                  : pf.mediaType === 'video'
                    ? <div className="h-7 w-7 rounded bg-purple-100 flex items-center justify-center shrink-0"><ImageIcon className="h-4 w-4 text-purple-600" /></div>
                    : pf.mediaType === 'audio'
                      ? <div className="h-7 w-7 rounded bg-orange-100 flex items-center justify-center shrink-0"><Music className="h-4 w-4 text-orange-600" /></div>
                      : <div className="h-7 w-7 rounded bg-blue-100 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-blue-600" /></div>
                }
                <span className="truncate text-xs">{pf.file.name}</span>
                <button type="button" aria-label="Remove file" onClick={() => removePendingFile(pf.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">

          {/* ── Left icons — outside the pill ── */}

          {/* Agent type toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:bg-muted flex-shrink-0',
                  agentType === 'human' ? 'text-orange-500' : 'text-green-500'
                )}
                title={agentType === 'human' ? 'Human agent' : 'AI agent'}
              >
                {agentType === 'human' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-popover z-50">
              <DropdownMenuItem onClick={() => handleAgentTypeChange('human')} className={cn(agentType === 'human' && 'bg-accent')}>
                <User className="h-4 w-4 mr-2" /> Human Agent
                {agentType === 'human' && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAgentTypeChange('ai')} className={cn(agentType === 'ai' && 'bg-accent')}>
                <Bot className="h-4 w-4 mr-2" /> AI Agent
                {agentType === 'ai' && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Attach menu */}
          <div ref={attachBtnRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowAttachMenu(v => !v)}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-muted',
                showAttachMenu
                  ? 'text-[#00a884] rotate-45'
                  : 'text-muted-foreground dark:text-white hover:text-foreground'
              )}
            >
              <Plus className="w-5 h-5" />
            </button>
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-[#2e2f2f] border border-gray-200 dark:border-[#3d3d3d] rounded-2xl shadow-xl p-3 z-40">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Attach</p>
                <div className="grid grid-cols-3 gap-1">
                  {ATTACH_ITEMS.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAttachItem(item.id)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-[#3d3d3d] transition-colors group"
                    >
                      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-transform group-hover:scale-105', item.bg)}>
                        {item.icon}
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-300 font-medium leading-tight text-center">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Emoji / Sticker — fixed position now anchored bottom-left of pill row */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              data-sticker-btn
              aria-label={showStickers ? 'Hide stickers' : 'Show stickers'}
              aria-pressed={showStickers ? 'true' : 'false'}
              onClick={() => setShowStickers(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground dark:text-white hover:text-foreground transition-colors"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showStickers && (
              <div data-sticker-picker>
                <StickerPicker
                  onSelect={(emoji: string) => {
                    // setText FIRST, then close, then focus — never call onClose from onSelect
                    setText(prev => prev + emoji);
                    setShowStickers(false);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  onClose={() => setShowStickers(false)}
                />
              </div>
            )}
          </div>

          {/* Template button */}
          <button
            type="button"
            onClick={() => setIsTemplatePickerOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground dark:text-white hover:text-foreground transition-colors flex-shrink-0"
            title="Send template message"
          >
            <LayoutTemplate className="w-5 h-5" />
          </button>

          {/* ── Pill — text input + send/mic only ── */}
          <div className="flex-1 flex items-center bg-[#f0f2f5] dark:bg-[#2e2f2f] rounded-full px-4 h-[44px] gap-2">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingFiles.length > 0 ? 'Add a caption (optional)…' : 'Type a message'}
              className="flex-1 bg-transparent border-0 text-foreground dark:text-[#e9edef] py-2.5 px-0 text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[#8696a0] dark:placeholder:text-[#a2a2a2] resize-none min-h-[24px] max-h-[120px] self-center"
              rows={1}
            />
            <div className="shrink-0 cursor-pointer transition-colors" onClick={handleSend}>
              {isSending
                ? <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                : (text.trim() || pendingFiles.length > 0)
                ? <Send className="w-6 h-6 text-[#00a884] hover:text-[#008f6f]" />
                : <Mic className="w-6 h-6 text-muted-foreground dark:text-white hover:text-foreground" />}
            </div>
          </div>

        </div>

        {(sendError || ownershipError) && (
          <div className="mt-1.5 px-3 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 bg-red-50 text-red-700 border border-red-200">
            <span>{sendError || ownershipError}</span>
            <button type="button" onClick={() => { setSendError(null); setOwnershipError(null); }} className="text-red-500 hover:text-red-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Template send result ── */}
        {templateSendResult && (
          <div className={cn('mt-1.5 px-3 py-1.5 rounded-md text-xs flex items-center gap-2',
            templateSendResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
            {templateSendResult.success ? '✓' : '✕'} {templateSendResult.message}
          </div>
        )}

        {/* ── Hint bar ── */}
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1 hidden lg:block">
          Enter to send · Shift+Enter for new line
          {agentType === 'human' && <span className="ml-2 text-orange-500 font-medium">· You have manual control</span>}
        </p>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* WABASidebar                                                               */
/* ========================================================================= */

interface WABASidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // ── Sort / filter ──────────────────────────────────────────────────────
  sortBy?: 'date' | 'message_count' | 'name';
  onSortByChange?: (sortBy: 'date' | 'message_count' | 'name') => void;
  hideEmpty?: boolean;
  onHideEmptyChange?: (hide: boolean) => void;
  selectedLabelIds?: string[];
  onLabelFilterChange?: (ids: string[]) => void;
  // ── Context status chips ───────────────────────────────────────────────
  contextStatusFilter?: string;
  onContextStatusFilterChange?: (status: string) => void;
  contextStatuses?: ContextStatusOption[];
  // ── Misc ──────────────────────────────────────────────────────────────
  backendChannel?: 'personal' | 'waba';
  onRefresh?: () => void;
  // ── Group management callbacks (passed through to overlay) ─────────────
  onShowCreateGroupModal?: (selectedIds: string[]) => void;
  groupRefreshKey?: number;
  activeLastMsg?: Message | null;
}

type FilterTab = 'all' | 'unread' | 'favourites' | 'groups';

function WABASidebar({
  conversations,
  selectedId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  sortBy = 'date',
  onSortByChange,
  hideEmpty = false,
  onHideEmptyChange,
  selectedLabelIds = [],
  onLabelFilterChange,
  contextStatusFilter = 'all',
  onContextStatusFilterChange,
  contextStatuses = [],
  backendChannel,
  onRefresh,
  onShowCreateGroupModal,
  groupRefreshKey,
  activeLastMsg,
}: WABASidebarProps) {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarError, setSidebarError] = useState<SidebarErrorState | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedChatIds(new Set());
  }, []);

  const toggleSelectChat = useCallback((id: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Template picker state ──────────────────────────────────────────────
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [templateSending, setTemplateSending] = useState(false);
  const [templateSendProgress, setTemplateSendProgress] = useState<{ sent: number; total: number; running: boolean } | null>(null);
  const [sendSummary, setSendSummary] = useState<{ sent: number; queued: number; scheduledDays: number } | null>(null);
  const [groupTemplateSendTarget, setGroupTemplateSendTarget] = useState<{ groupIds: string[]; count: number } | null>(null);

  // ── Rich New Chat overlay state (mirrors ConversationSidebar) ──────────
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatGroups, setNewChatGroups] = useState<ChatGroup[]>([]);
  const [newChatGroupsLoading, setNewChatGroupsLoading] = useState(false);
  const [selectedNewChatIds, setSelectedNewChatIds] = useState<Set<string>>(new Set());
  const [selectedNewChatGroupIds, setSelectedNewChatGroupIds] = useState<Set<string>>(new Set());
  const [newChatContacts, setNewChatContacts] = useState<Conversation[]>([]);
  const [newChatContactsLoading, setNewChatContactsLoading] = useState(false);
  const [newChatContactsTotal, setNewChatContactsTotal] = useState(0);
  const [groupsSectionExpanded, setGroupsSectionExpanded] = useState(true);
  const [contactsSectionExpanded, setContactsSectionExpanded] = useState(true);
  const [importRefreshTrigger, setImportRefreshTrigger] = useState(0);
  const deferredNewChatSearch = useDeferredValue(newChatSearch.trim());
  const deferredSidebarSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  const normalizePhone = useCallback((value?: string) => (value || '').replace(/\D/g, ''), []);
  const conversationIdByLead = useMemo(() => {
    const map = new Map<string, string>();
    conversations.forEach((conv) => {
      const lead = getConversationLeadId(conv);
      if (lead) map.set(String(lead), conv.id);
    });
    return map;
  }, [conversations]);
  const conversationIdByPhone = useMemo(() => {
    const map = new Map<string, string>();
    conversations.forEach((conv) => {
      const phone = normalizePhone(conv.contact?.phone);
      if (phone) map.set(phone, conv.id);
    });
    return map;
  }, [conversations, normalizePhone]);

  // ── Import dialog ──────────────────────────────────────────────────────
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // ── Group manager dialog ───────────────────────────────────────────────
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [createGroupIds, setCreateGroupIds] = useState<string[]>([]);

  // ── Label library (fetched once if parent opts in) ─────────────────────
  const [allLabels, setAllLabels] = useState<Array<{ id: string; name: string; color: string }>>([]);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectMode) exitSelectMode();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSelectMode, exitSelectMode]);

  useEffect(() => {
    if (!onLabelFilterChange) return;
    let cancelled = false;
    fetchWithTenant('/api/whatsapp-conversations/labels')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.labels) ? data.labels : [];
        const safeRows = rows as Array<{ id?: string | number; name?: string; color?: string }>;
        setAllLabels(
          safeRows
            .filter((l) => l.id != null && typeof l.name === 'string')
            .map((l) => ({ id: String(l.id), name: l.name as string, color: l.color || '#808080' }))
        );
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [onLabelFilterChange]);

  // ── Load groups whenever New Chat panel is open or group manager closes ─
  useEffect(() => {
    const groupsChannel = backendChannel || 'waba';
    setNewChatGroupsLoading(true);
    fetchWithTenant(`/api/whatsapp-conversations/chat-groups?channel=${groupsChannel}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.data)) setNewChatGroups(data.data); })
      .catch(() => { })
      .finally(() => setNewChatGroupsLoading(false));
  }, [isNewChatOpen, isGroupManagerOpen, backendChannel, groupRefreshKey]);

  // ── Load contacts when New Chat panel opens ────────────────────────────
  useEffect(() => {
    if (!isNewChatOpen) return;
    let cancelled = false;
    setNewChatContacts([]);
    setNewChatContactsTotal(0);
    setNewChatContactsLoading(true);

    const PAGE_SIZE = 200;
    const ch = backendChannel || 'waba';
    const searchParam = deferredNewChatSearch ? `&search=${encodeURIComponent(deferredNewChatSearch)}` : '';

    const mapContact = (rawRecord: Record<string, unknown>): Conversation => {
      const raw = rawRecord as Record<string, unknown> & { contact?: Conversation['contact'] };
      if (raw.contact) return raw as unknown as Conversation;
      const leadId = raw.lead_id || raw.leadId || raw.id;
      const phone = String(raw.lead_phone || raw.phone || '');
      const normalizedPhone = normalizePhone(phone);
      const existingConversationId =
        raw.conversation_id ||
        raw.conversationId ||
        (leadId ? conversationIdByLead.get(String(leadId)) : undefined) ||
        (normalizedPhone ? conversationIdByPhone.get(normalizedPhone) : undefined);

      return {
        id: existingConversationId || String(raw.id || leadId || phone),
        contact: {
          name: raw.lead_name || raw.name || raw.contact_name || '',
          phone,
        },
      } as unknown as Conversation;
    };

    if (ch === 'personal') {
      const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

      const fetchPage = async (offset: number, retries = 1): Promise<{ raw: Array<Record<string, unknown>>; total: number } | null> => {
        try {
          const r = await fetchWithTenant(
            `/api/whatsapp-conversations/contacts?channel=personal&limit=${PAGE_SIZE}&offset=${offset}${searchParam}`
          );
          if (!r.ok) return null;
          const data = await r.json();
          const raw = (Array.isArray(data.contacts) ? data.contacts : (Array.isArray(data.data) ? data.data : [])) as Array<Record<string, unknown>>;
          return { raw, total: Number(data.total || 0) };
        } catch {
          if (retries > 0) { await sleep(500); return fetchPage(offset, retries - 1); }
          return null;
        }
      };

      const loadPage = async (offset: number, accumulated: Conversation[]) => {
        const result = await fetchPage(offset);
        if (!result) return;
        const { raw, total } = result;
        const mapped = raw.map(mapContact);
        if (cancelled) return;
        const all = [...accumulated, ...mapped];
        setNewChatContacts(all);
        setNewChatContactsTotal(total);
        if (all.length < total && raw.length === PAGE_SIZE) {
          await sleep(150);
          await loadPage(offset + PAGE_SIZE, all);
        }
      };

      loadPage(0, []).finally(() => {
        if (!cancelled) setNewChatContactsLoading(false);
      });
    } else {
      fetchWithTenant(`/api/whatsapp-conversations/conversations?channel=waba&limit=500${searchParam}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const raw = (Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])) as Array<Record<string, unknown>>;
          const list: Conversation[] = raw.map(mapContact);
          setNewChatContacts(list);
          setNewChatContactsTotal(data.total || list.length);
        })
        .catch(() => { })
        .finally(() => {
          if (!cancelled) setNewChatContactsLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [
    isNewChatOpen,
    backendChannel,
    importRefreshTrigger,
    deferredNewChatSearch,
    conversationIdByLead,
    conversationIdByPhone,
    normalizePhone,
  ]);

  const openChatFromNewContact = useCallback((conv: Conversation) => {
    const leadId = getConversationLeadId(conv);
    const normalizedPhone = normalizePhone(conv.contact?.phone);
    const resolvedConversationId =
      (conversations.some((c) => c.id === conv.id) ? conv.id : undefined) ||
      (leadId ? conversationIdByLead.get(String(leadId)) : undefined) ||
      (normalizedPhone ? conversationIdByPhone.get(normalizedPhone) : undefined) ||
      conv.id;

    setIsNewChatOpen(false);
    setNewChatSearch('');
    setSelectedNewChatIds(new Set());
    setSelectedNewChatGroupIds(new Set());
    onSelectConversation(resolvedConversationId);
  }, [
    conversations,
    conversationIdByLead,
    conversationIdByPhone,
    normalizePhone,
    onSelectConversation,
  ]);

  // ── Refresh handler ────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    setSidebarError(null);
    const channelParam = backendChannel ? `?channel=${backendChannel}` : '';
    fetchWithTenant(`/api/whatsapp-conversations/accounts/sync${channelParam}`, { method: 'POST' })
      .catch((err: unknown) => {
        setSidebarError({ message: getErrorMessage(err, 'Failed to refresh conversations') });
      })
      .finally(() => {
        setTimeout(() => {
          onRefresh();
          setIsRefreshing(false);
        }, 15000);
      });
  }, [onRefresh, isRefreshing, backendChannel]);

  // ── Group template send handlers ───────────────────────────────────────
  const handleGroupTemplateSend = useCallback((groupId: string, conversationCount: number) => {
    setGroupTemplateSendTarget({ groupIds: [groupId], count: conversationCount });
    setIsTemplatePickerOpen(true);
  }, []);

  const handleGroupsTemplateSend = useCallback((selectedGroups: ChatGroup[]) => {
    const groupIds = selectedGroups.map(g => g.id);
    const totalCount = selectedGroups.reduce((acc, g) =>
      acc + (g.metadata?.wa_group && g.metadata.participant_count
        ? g.metadata.participant_count
        : g.conversation_count), 0);
    setGroupTemplateSendTarget({ groupIds, count: totalCount });
    setIsTemplatePickerOpen(true);
  }, []);

  // ── Template send handler (mirrors ConversationSidebar.handleTemplateSend) ─
  const handleTemplateSend = useCallback(
    async (
      templateName: string,
      languageCode: string,
      parameters: string[],
      nameFormat: 'first' | 'full' = 'first',
      batch = { batchSize: 5, delayMin: 120, delayRandom: 30, dailyLimit: 250 },
      headerParamCount = 0,
      headerType = '',
      headerUrl = '',
    ) => {
      setTemplateSending(true);
      const totalCount = groupTemplateSendTarget?.count ?? 0;
      setTemplateSendProgress({ sent: 0, total: totalCount, running: true });

      try {
        if (groupTemplateSendTarget) {
          const channelParam = backendChannel === 'personal' ? '?channel=personal' : '';
          const { batchSize, delayMin, delayRandom, dailyLimit } = batch;
          const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
          let sentTotal = 0;

          for (let i = 0; i < groupTemplateSendTarget.groupIds.length; i++) {
            const groupId = groupTemplateSendTarget.groupIds[i];
            try {
              const res = await fetchWithTenant(
                `/api/whatsapp-conversations/chat-groups/${groupId}/send-template${channelParam}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    template_name: templateName,
                    language_code: languageCode,
                    parameters,
                    name_format: nameFormat,
                    batch_size: batchSize,
                    delay_min: delayMin,
                    delay_random: delayRandom,
                    daily_limit: dailyLimit,
                    header_param_count: headerParamCount,
                    header_type: headerType,
                    header_url: headerUrl,
                  }),
                }
              );
              const data = await res.json();
              if (data.success) {
                sentTotal += data.sent || 0;
                setTemplateSendProgress(prev => prev ? { ...prev, sent: sentTotal } : null);
                if (data.queued > 0) {
                  setSendSummary(prev => ({
                    sent: (prev?.sent ?? 0) + (data.sent ?? 0),
                    queued: (prev?.queued ?? 0) + (data.queued ?? 0),
                    scheduledDays: Math.max(prev?.scheduledDays ?? 0, data.scheduled_days ?? 0),
                  }));
                }
              }
              if (!data.success) {
                setSidebarError({ message: data.error || `Failed to send template to group ${groupId}` });
              }
            } catch (err) {
              setSidebarError({ message: getErrorMessage(err, `Failed to send template to group ${groupId}`) });
            }

            const isLastGroup = i === groupTemplateSendTarget.groupIds.length - 1;
            const batchBoundary = (i + 1) % batchSize === 0;
            if (!isLastGroup && batchBoundary) {
              await sleep((delayMin + Math.random() * delayRandom) * 1000);
            }
          }
        } else if (selectedChatIds.size > 0) {
          const channelParam = backendChannel ? `?channel=${backendChannel}` : '?channel=waba';
          const bulkEndpoint = backendChannel === 'personal'
            ? `/api/whatsapp-conversations/conversations/bulk/send-template${channelParam}`
            : `/api/whatsapp-conversations/conversations/bulk${channelParam}`;
          const res = await fetchWithTenant(bulkEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send-template',
              conversation_ids: Array.from(selectedChatIds),
              template_name: templateName,
              language_code: languageCode,
              parameters,
              name_format: nameFormat,
              batch_size: batch.batchSize,
              delay_min: batch.delayMin,
              delay_random: batch.delayRandom,
              daily_limit: batch.dailyLimit ?? 250,
              header_param_count: headerParamCount,
              header_type: headerType,
              header_url: headerUrl,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            setSidebarError({ message: data.error || 'Bulk template send failed' });
          } else {
            setTemplateSendProgress(prev => prev ? { ...prev, sent: data.sent || 0, running: false } : null);
          }
        }
      } catch (err) {
        setSidebarError({ message: getErrorMessage(err, 'Template send failed') });
        setTemplateSendProgress(null);
      } finally {
        setTemplateSending(false);
        setIsTemplatePickerOpen(false);
        setGroupTemplateSendTarget(null);
      }
    },
    [groupTemplateSendTarget, backendChannel]
  );

  const filteredConversations = useMemo(() => {
    const filtered = conversations.filter((conv) => {
      const matchesSearch = deferredSidebarSearch
        ? conv.contact?.name?.toLowerCase().includes(deferredSidebarSearch) ||
        conv.contact?.phone?.toLowerCase().includes(deferredSidebarSearch)
        : true;
      if (!matchesSearch) return false;
      if (filterTab === 'unread') return Boolean(conv.unreadCount && conv.unreadCount > 0);
      const extendedConv = conv as Conversation & { isFavorite?: boolean; favorite?: boolean; is_group?: boolean; isGroup?: boolean; groupId?: string };
      if (filterTab === 'favourites') return Boolean(extendedConv.is_favorite || extendedConv.isFavorite || extendedConv.favorite);
      if (filterTab === 'groups') return Boolean(extendedConv.is_group || extendedConv.isGroup || extendedConv.groupId);
      if (hideEmpty && !conv.lastMessage && !conv.messageCount && !conv.messages?.length) return false;
      if (contextStatusFilter !== 'all' && getConversationContextStatus(conv) !== contextStatusFilter) return false;
      if (selectedLabelIds.length > 0) {
        const labelIds = getConversationLabelIds(conv);
        if (!selectedLabelIds.every((id) => labelIds.includes(id))) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.contact?.name || a.contact?.phone || '').localeCompare(b.contact?.name || b.contact?.phone || '');
      }
      if (sortBy === 'message_count') {
        return (b.messageCount || b.messages?.length || 0) - (a.messageCount || a.messages?.length || 0);
      }
      const aTime = new Date(getConversationLastMessageTimestamp(a) || a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(getConversationLastMessageTimestamp(b) || b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [conversations, contextStatusFilter, deferredSidebarSearch, filterTab, hideEmpty, selectedLabelIds, sortBy]);

  const unreadCount = conversations.filter((c) => c.unreadCount && c.unreadCount > 0).length;

  // ── Label toggle helper ────────────────────────────────────────────────
  const toggleLabel = useCallback(
    (id: string) => {
      if (!onLabelFilterChange) return;
      onLabelFilterChange(
        selectedLabelIds.includes(id)
          ? selectedLabelIds.filter((x) => x !== id)
          : [...selectedLabelIds, id]
      );
    },
    [selectedLabelIds, onLabelFilterChange]
  );

  const templatePickerCount = groupTemplateSendTarget?.count ?? selectedChatIds.size;

  return (
    // IMPORTANT: `relative` here is what allows the absolute overlay to cover this column only
    <div className="h-full flex flex-col overflow-visible bg-background text-foreground dark:bg-[#161717] relative">
      {sidebarError && (
        <div className="mx-4 mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200">
          <div className="flex items-center justify-between gap-3">
            <span>{sidebarError.message}</span>
            <button type="button" className="underline underline-offset-2" onClick={() => setSidebarError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h1 className="text-[22px] font-bold dark:text-white">WhatsApp</h1>
        <TooltipProvider delayDuration={100}>
          <div className="flex items-center gap-2 text-muted-foreground dark:text-white">

            {/* ── New Template ── onClick: open TemplatePicker (same as file 1) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  onClick={() => setIsTemplatePickerOpen(true)}
                  aria-label="New template"
                >
                  <LayoutTemplate className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="z-[9999] bg-zinc-800 text-white border-0 text-[10px]">
                <p>New template</p>
              </TooltipContent>
            </Tooltip>

            {/* ── Refresh ── onClick: handleRefresh (same as file 1) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh conversations"
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="z-[9999] bg-zinc-800 text-white border-0 text-[10px]">
                <p>Refresh conversations</p>
              </TooltipContent>
            </Tooltip>

            {/* ── New Chat ── onClick: open rich overlay (same as file 1's setIsNewChatOpen) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  onClick={() => setIsNewChatOpen(true)}
                  aria-label="New Chat"
                >
                  <MessageSquarePlus className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="z-[9999] bg-zinc-800 text-white border-0 text-[10px]">
                <p>New Chat</p>
              </TooltipContent>
            </Tooltip>

            {/* ── More Options ── */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="z-[9999] bg-zinc-800 text-white border-0 text-[10px]">
                  <p>More options</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="w-52 bg-white dark:bg-[#161717] border border-border dark:border-0 text-foreground dark:text-[#d1d7db] py-2 shadow-lg"
              >
                <DropdownMenuItem
                  className="focus:bg-muted dark:focus:bg-muted hover:bg-muted dark:hover:bg-muted focus:text-foreground dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4"
                  onClick={() => setIsGroupManagerOpen(true)}
                >
                  <Users className="w-4 h-4" /><span>Broadcast group</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-muted dark:focus:bg-muted hover:bg-muted dark:hover:bg-muted focus:text-foreground dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                  <Star className="w-4 h-4" /><span>Starred messages</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-muted dark:focus:bg-muted hover:bg-muted dark:hover:bg-muted focus:text-foreground dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4"
                  onClick={() => setIsSelectMode(true)}
                >
                  <CheckSquare className="w-4 h-4" /><span>Select chats</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-muted dark:focus:bg-muted hover:bg-muted dark:hover:bg-muted focus:text-foreground dark:focus:text-white cursor-pointer py-2.5 px-4 flex items-center gap-4">
                  <ListChecks className="w-4 h-4" /><span>Mark all as read</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </TooltipProvider>
      </div>

      {/* Search */}
      <div className="px-4 pb-3 pt-1 relative z-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground dark:text-[#a2a2a2]" />
          <Input
            placeholder="Search or start a new chat"
            className="pl-10 bg-[#f0f2f5] dark:bg-[#2e2f2f] border-0 rounded-full h-9 text-sm text-foreground dark:text-white placeholder:text-muted-foreground dark:text-[#a2a2a2] focus-visible:ring-1 focus-visible:ring-transparent"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-[#202c33] rounded-lg shadow-lg z-[999] max-h-60 overflow-y-auto border dark:border-[#2a3942]">
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => { onSelectConversation(conv.id); onSearchChange(''); }}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a3942]"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={conv.contact?.avatar} />
                      <AvatarFallback>{conv.contact?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground dark:text-white">{conv.contact?.name}</p>
                      <p className="text-xs text-muted-foreground dark:text-[#a2a2a2]">{conv.contact?.phone}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground dark:text-[#8696a0] text-center">No results found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter Chips (All / Unread / Favourites / Groups) + Sort/Filter */}
      <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-border dark:border-[#222d34]/80">
        {(['all', 'unread', 'favourites', 'groups'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors border',
              filterTab === tab
                ? 'bg-[#0a332c] dark:bg-[#1a342a] text-[#00a884] border-transparent'
                : 'bg-muted/50 dark:bg-[#161717] dark:border-[#2e2f2f] text-muted-foreground dark:text-[#a2a2a2] hover:bg-muted dark:hover:bg-[#2a3942]'
            )}
          >
            {tab === 'unread' ? `Unread${unreadCount > 0 ? ` ${unreadCount}` : ''}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}

        {/* ── Sort button — same pill style ── */}
        {onSortByChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                'px-3 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors border flex items-center gap-1',
                'bg-muted/50 dark:bg-[#161717] dark:border-[#2e2f2f] text-muted-foreground dark:text-[#a2a2a2] hover:bg-muted dark:hover:bg-[#2a3942]'
              )}>
                <ArrowDownUp className="h-3.5 w-3.5" />
                {sortBy === 'message_count' ? 'Size' : sortBy === 'name' ? 'Name' : 'Date'}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 bg-white dark:bg-[#161717] border border-border dark:border-0 shadow-lg text-foreground dark:text-[#d1d7db]">
              <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSortByChange('date')} className={cn('text-xs cursor-pointer', sortBy === 'date' && 'bg-[#0a332c] dark:bg-[#1a342a] text-[#00a884]')}>
                <Calendar className="h-3.5 w-3.5 mr-2" /> Date (most recent)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortByChange('message_count')} className={cn('text-xs cursor-pointer', sortBy === 'message_count' && 'bg-[#0a332c] dark:bg-[#1a342a] text-[#00a884]')}>
                <Hash className="h-3.5 w-3.5 mr-2" /> Size (most messages)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortByChange('name')} className={cn('text-xs cursor-pointer', sortBy === 'name' && 'bg-[#0a332c] dark:bg-[#1a342a] text-[#00a884]')}>
                <ArrowDownUp className="h-3.5 w-3.5 mr-2" /> Name (A → Z)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* ── Hide Empty button — same pill style ── */}
        {onHideEmptyChange && (
          <button
            type="button"
            onClick={() => onHideEmptyChange(!hideEmpty)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors border flex items-center gap-1',
              hideEmpty
                ? 'bg-[#0a332c] dark:bg-[#1a342a] text-[#00a884] border-transparent'
                : 'bg-muted/50 dark:bg-[#161717] dark:border-[#2e2f2f] text-muted-foreground dark:text-[#a2a2a2] hover:bg-muted dark:hover:bg-[#2a3942]'
            )}
          >
            {hideEmpty ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {hideEmpty ? 'Hiding empty' : 'Hide empty'}
          </button>
        )}

        {/* ── Labels dropdown — same pill style ── */}
        {onLabelFilterChange && allLabels.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                'px-3 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors border flex items-center gap-1',
                selectedLabelIds.length > 0
                  ? 'bg-[#0a332c] dark:bg-[#1a342a] text-[#00a884] border-transparent'
                  : 'bg-muted/50 dark:bg-[#161717] dark:border-[#2e2f2f] text-muted-foreground dark:text-[#a2a2a2] hover:bg-muted dark:hover:bg-[#2a3942]'
              )}>
                <Tag className="h-3.5 w-3.5" />
                {selectedLabelIds.length > 0 ? `${selectedLabelIds.length} label${selectedLabelIds.length === 1 ? '' : 's'}` : 'Labels'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto bg-white dark:bg-[#161717] border border-border dark:border-0 shadow-lg">
              <DropdownMenuLabel className="flex items-center justify-between text-xs">
                <span>Filter by label</span>
                {selectedLabelIds.length > 0 && (
                  <button onClick={() => onLabelFilterChange([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allLabels.map((l) => (
                <DropdownMenuCheckboxItem
                  key={l.id}
                  checked={selectedLabelIds.includes(l.id)}
                  onCheckedChange={() => toggleLabel(l.id)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: l.color }} />
                  <span className="truncate">{l.name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* ── Context Status chips — inline in the same row ── */}
        {contextStatuses.map(({ value, label, count }) => (
          <button
            type="button"
            key={value}
            onClick={() => onContextStatusFilterChange?.(value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors border',
              contextStatusFilter === value
                ? 'bg-[#00a884] text-white border-transparent'
                : 'bg-muted/50 dark:bg-[#161717] dark:border-[#2e2f2f] text-muted-foreground dark:text-[#a2a2a2] hover:bg-muted dark:hover:bg-[#2a3942]'
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn('ml-1 text-[10px]', contextStatusFilter === value ? 'opacity-80' : 'opacity-60')}>
                {count}
              </span>
            )}
          </button>
        ))}

        {/* ── New List + button (keep at the end) ── */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="px-3 py-1.5 rounded-full bg-muted/50 dark:bg-[#202c33] text-muted-foreground dark:text-[#a2a2a2] text-[14px] font-normal flex items-center justify-center hover:bg-muted dark:hover:bg-zinc-800 shrink-0 border dark:border-[#2e2f2f]" aria-label="Create list">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-zinc-800 text-white border-0 text-[10px]"><p>New List</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* ── Active context status filter indicator ────────────────────────── */}
      {contextStatusFilter && contextStatusFilter !== 'all' && (
        <div className="px-3 py-1.5 border-b border-border dark:border-[#222d34]/80 bg-[#0a332c]/20 dark:bg-[#1a342a]/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-[#00a884]" />
            <span className="text-muted-foreground dark:text-[#a2a2a2]">Filtered:</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00a884] text-white">
              {formatContextStatus(contextStatusFilter)}
            </span>
          </div>
          <button
            onClick={() => onContextStatusFilterChange?.('all')}
            className="text-[#00a884] hover:text-[#008f6f] text-xs flex items-center gap-0.5 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {/* ── Chat List ─────────────────────────────────────────────────────── */}
      {/* ── Select mode bar ── */}
      {isSelectMode && (
        <div className="px-3 py-2 border-b border-border dark:border-[#222d34]/80 bg-[#0a332c]/10 dark:bg-[#1a342a]/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-[#00a884]">
            <CheckSquare className="h-4 w-4" />
            <span>{selectedChatIds.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const allIds = filteredConversations.map(c => c.id);
                const allSelected = allIds.every(id => selectedChatIds.has(id));
                if (allSelected) {
                  setSelectedChatIds(new Set());
                } else {
                  setSelectedChatIds(new Set(allIds));
                }
              }}
              className="text-[10px] text-[#00a884] hover:text-[#008f6f] font-medium transition-colors"
            >
              {filteredConversations.every(c => selectedChatIds.has(c.id)) ? 'Deselect all' : 'Select all'}
            </button>
            <button
              onClick={exitSelectMode}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {isSelectMode && (
        <TooltipProvider>
          <div className="p-2 border-b border-border dark:border-[#222d34]/80 bg-[#0a332c]/5 dark:bg-[#1a342a]/10 flex items-center gap-2">
            <button
              onClick={() =>
                selectedChatIds.size === filteredConversations.length
                  ? setSelectedChatIds(new Set())
                  : setSelectedChatIds(new Set(filteredConversations.map((c) => c.id)))
              }
              className="flex items-center gap-1.5 px-1"
            >
              {selectedChatIds.size === filteredConversations.length && selectedChatIds.size > 0 ? (
                <CheckSquare className="h-4 w-4 text-[#00a884]" />
              ) : selectedChatIds.size > 0 ? (
                <MinusCircle className="h-4 w-4 text-[#00a884]" />
              ) : (
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <span className="text-xs text-muted-foreground dark:text-[#a2a2a2] flex-1">
              {selectedChatIds.size} selected
            </span>

            <AddToGroupDropdown
              selectedIds={selectedChatIds}
              onDone={exitSelectMode}
              channel={backendChannel}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Send Template"
                  onClick={() => {
                    setGroupTemplateSendTarget(null);
                    setIsTemplatePickerOpen(true);
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1 font-bold uppercase tracking-wider bg-zinc-800 text-white border-0">
                Send Template
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Resolve"
                  onClick={async () => {
                    const channelParam = backendChannel ? `?channel=${backendChannel}` : '?channel=waba';
                    try {
                      const res = await fetchWithTenant(
                        `/api/whatsapp-conversations/conversations/bulk${channelParam}`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'resolve', conversation_ids: Array.from(selectedChatIds) }),
                        }
                      );
                      if (!res.ok) {
                        throw new Error(await getApiErrorMessage(res, 'Failed to resolve selected conversations'));
                      }
                      onRefresh?.();
                    } catch (err: unknown) {
                      setSidebarError({ message: getErrorMessage(err, 'Bulk resolve failed') });
                    }
                    exitSelectMode();
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1 font-bold uppercase tracking-wider bg-zinc-800 text-white border-0">
                Resolve
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={async () => {
                    const channelParam = backendChannel ? `?channel=${backendChannel}` : '?channel=waba';
                    try {
                      const res = await fetchWithTenant(
                        `/api/whatsapp-conversations/conversations/bulk${channelParam}`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'delete', conversation_ids: Array.from(selectedChatIds) }),
                        }
                      );
                      if (!res.ok) {
                        throw new Error(await getApiErrorMessage(res, 'Failed to delete selected conversations'));
                      }
                      onRefresh?.();
                    } catch (err: unknown) {
                      setSidebarError({ message: getErrorMessage(err, 'Bulk delete failed') });
                    }
                    exitSelectMode();
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] px-2 py-1 font-bold uppercase tracking-wider bg-zinc-800 text-white border-0">
                Delete
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
      <div className="flex-1 overflow-y-auto mt-0 relative z-0">
        {filterTab === 'favourites' ? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-4 h-[80%]">
            <div className="w-32 h-32 bg-muted/50 dark:bg-[#202c33] rounded-full flex items-center justify-center mb-4 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <svg viewBox="0 0 100 100" width="80" height="80" fill="none" stroke="#00a884" strokeWidth="4">
                  <rect x="20" y="20" width="60" height="60" rx="8" />
                  <circle cx="50" cy="40" r="10" />
                  <path d="M30 70 C30 50, 70 50, 70 70" />
                </svg>
              </div>
              <div className="absolute -right-2 -bottom-2 text-[#00a884]">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold">Add to Favourites</h2>
            <p className="text-[15px] text-muted-foreground dark:text-[#8696a0] mt-2">
              Make it easy to find the people and groups that matter most across WhatsApp.
            </p>
            <button className="mt-4 text-[#00a884] text-[15px] font-medium hover:underline">Add to Favourites</button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground dark:text-[#8696a0]">
            No chats found for this filter.
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = selectedId === conv.id;
            const initials = conv.contact?.name?.substring(0, 2).toUpperCase();
            const convLastMessage = (conv as Conversation & { lastMessage?: Message }).lastMessage;
            let lastMsg = convLastMessage || conv.messages?.[conv.messages.length - 1];
            if (isSelected && activeLastMsg) {
              lastMsg = activeLastMsg;
            }
            const time = lastMsg
              ? formatDistanceToNow(new Date(lastMsg.timestamp || lastMsg.created_at || new Date()), { addSuffix: false })
              : '';

            return (
              <div
                key={conv.id}
                onClick={() => isSelectMode ? toggleSelectChat(conv.id) : onSelectConversation(conv.id)}
                className={cn(
                  'flex items-center gap-4 py-2 px-4 mx-2 cursor-pointer transition-colors rounded-xl',
                  isSelectMode && selectedChatIds.has(conv.id)
                    ? 'bg-emerald-50 dark:bg-emerald-950/20'
                    : isSelected ? 'bg-[#d9fdd3] dark:bg-[#2e2f2f]' : 'hover:bg-muted/30 dark:hover:bg-[#2e2f2f]/50'
                )}
              >
                {isSelectMode && (
                  <div className={cn(
                    'h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    selectedChatIds.has(conv.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'
                  )}>
                    {selectedChatIds.has(conv.id) && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                )}
                <Avatar className="w-11 h-11 shrink-0">
                  <AvatarImage src={conv.contact?.avatar} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-medium text-[16px] truncate text-foreground dark:text-white">{conv.contact?.name}</span>
                    <span className={cn('text-xs', conv.unreadCount ? 'text-[#25D366] dark:text-[#00a884] font-medium' : 'text-muted-foreground dark:text-[#a2a2a2]')}>
                      {time}
                    </span>
                  </div>
                  {/* Conversation stage chip (context_status) — mirrors the
                      older ConversationListItem badge so the new WhatsApp UI
                      keeps showing the state-machine stage. */}
                  {(() => {
                    const stage = getConversationContextStatus(conv);
                    if (!stage) return null;
                    const colorCls = WABA_STAGE_CHIP_COLORS[stage.toLowerCase()] || WABA_STAGE_CHIP_DEFAULT;
                    return (
                      <div className="mb-0.5">
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] px-1.5 py-0 h-3.5 font-medium border', colorCls)}
                        >
                          {formatContextStatus(stage)}
                        </Badge>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                      {(lastMsg?.isOutgoing || lastMsg?.role === 'assistant' || lastMsg?.role === 'human_agent') && !conv.unreadCount && (
  <MessageTicks status={lastMsg?.status || lastMsg?.message_status} />
)}
                      <span className="text-[14px] text-muted-foreground dark:text-[#a2a2a2] truncate max-w-[80%]">
                        {lastMsg?.content || 'Started conversation'}
                      </span>
                    </div>
                    {conv.unreadCount ? (
                      <div className="w-[20px] h-[20px] rounded-full bg-[#25D366] dark:bg-[#00a884] text-[11px] font-bold text-white dark:text-[#111b21] flex items-center justify-center">
                        {conv.unreadCount}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Rich New Chat Overlay — mirrors ConversationSidebar's isNewChatOpen panel
          absolute inset-0 z-30 so it covers only this sidebar column
      ════════════════════════════════════════════════════════════════════ */}
      {isNewChatOpen && (
        <div className="absolute inset-0 z-30 bg-card dark:bg-[#111b21] flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border dark:border-[#222d34] bg-card dark:bg-[#161717]">
            <button
              className="h-8 w-8 rounded-full hover:bg-muted flex-shrink-0 flex items-center justify-center transition-colors"
              onClick={() => {
                setIsNewChatOpen(false);
                setNewChatSearch('');
                setSelectedNewChatIds(new Set());
                setSelectedNewChatGroupIds(new Set());
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold flex-1">New chat</span>
            {(selectedNewChatIds.size > 0 || selectedNewChatGroupIds.size > 0) && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                {selectedNewChatIds.size + selectedNewChatGroupIds.size} selected
              </span>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-border dark:border-[#222d34]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or number"
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                className="pl-9 h-9 bg-secondary/50 dark:bg-[#2e2f2f] rounded-full border-0"
                autoFocus
              />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col border-b border-border dark:border-[#222d34]">
            {/* Import Leads */}
            <button
              onClick={() => {
                setIsNewChatOpen(false);
                setNewChatSearch('');
                setIsImportDialogOpen(true);
              }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted dark:hover:bg-[#202c33] transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-medium">Import Leads</span>
            </button>

            {/* New Broadcast */}
            <button
              onClick={() => {
                setIsNewChatOpen(false);
                setNewChatSearch('');
                setIsGroupManagerOpen(true);
              }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted dark:hover:bg-[#202c33] transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-medium">New Broadcast</span>
            </button>
          </div>

          {/* Scrollable Groups & Contacts list */}
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const searchLower = newChatSearch.toLowerCase();

              const filteredGroups = searchLower
                ? newChatGroups.filter((g) => g.name.toLowerCase().includes(searchLower))
                : newChatGroups;

              const contactSource = newChatContacts;
              const filteredContacts = searchLower
                ? contactSource.filter((c) =>
                  (c.contact?.name || '').toLowerCase().includes(searchLower) ||
                  (c.contact?.phone || '').includes(searchLower)
                )
                : contactSource;
              const contactsLoadedAll = newChatContactsTotal > 0 && newChatContacts.length >= newChatContactsTotal;
              const noResults = filteredGroups.length === 0 && filteredContacts.length === 0 && !newChatContactsLoading;

              return (
                <>
                  {/* ── Groups Section ── */}
                  {filteredGroups.length > 0 && (
                    <>
                      <div className="px-4 py-2 flex items-center justify-between">
                        <button
                          onClick={() => setGroupsSectionExpanded(v => !v)}
                          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                          {groupsSectionExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          Groups
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const allGroupIds = filteredGroups.map(g => g.id);
                              const allSelected = allGroupIds.every(id => selectedNewChatGroupIds.has(id));
                              if (allSelected) {
                                setSelectedNewChatGroupIds(prev => {
                                  const next = new Set(prev);
                                  allGroupIds.forEach(id => next.delete(id));
                                  return next;
                                });
                              } else {
                                setSelectedNewChatGroupIds(prev => new Set([...prev, ...allGroupIds]));
                              }
                            }}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                          >
                            {filteredGroups.every(g => selectedNewChatGroupIds.has(g.id)) ? 'Deselect all' : 'Select all'}
                          </button>
                          <span className="text-[10px] text-muted-foreground">
                            {selectedNewChatGroupIds.size}/{filteredGroups.length}
                          </span>
                        </div>
                      </div>

                      {groupsSectionExpanded && filteredGroups.map((group) => {
                        const isChecked = selectedNewChatGroupIds.has(group.id);
                        return (
                          <div
                            key={group.id}
                            className="group/item relative px-4 py-3 hover:bg-muted/60 dark:hover:bg-[#202c33]/60 transition-colors rounded-lg mx-2 my-1"
                          >
                            <div className="flex items-center gap-3 w-full">
                              {/* Checkbox */}
                              <button
                                onClick={() => {
                                  setSelectedNewChatGroupIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(group.id)) next.delete(group.id);
                                    else next.add(group.id);
                                    return next;
                                  });
                                }}
                                className={cn(
                                  'h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                  isChecked
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                                )}
                              >
                                {isChecked && (
                                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                              {/* Group avatar */}
                              <div
                                className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: group.color || '#64748b' }}
                              >
                                <Users className="h-6 w-6 text-white" />
                              </div>
                              {/* Group info */}
                              <div className="flex flex-col items-start overflow-hidden flex-1 min-w-0">
                                <span className="text-sm font-semibold truncate w-full text-left">{group.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {group.conversation_count} member{group.conversation_count !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {/* Hover action buttons */}
                              <TooltipProvider>
                                <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => {
                                          handleGroupTemplateSend(group.id, group.conversation_count);
                                          setIsNewChatOpen(false);
                                          setNewChatSearch('');
                                          setSelectedNewChatIds(new Set());
                                          setSelectedNewChatGroupIds(new Set());
                                        }}
                                        className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md transition-all hover:shadow-sm"
                                      >
                                        <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">Send template</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={async () => {
                                          if (!confirm(`Delete "${group.name}"?`)) return;
                                          try {
                                            const channelParam = backendChannel === 'personal' ? '?channel=personal' : '';
                                            const res = await fetchWithTenant(
                                              `/api/whatsapp-conversations/chat-groups/${group.id}${channelParam}`,
                                              { method: 'DELETE' }
                                            );
                                            if (res.ok) {
                                              setNewChatGroupsLoading(true);
                                              fetchWithTenant(`/api/whatsapp-conversations/chat-groups?channel=${backendChannel || 'waba'}`)
                                                .then((r) => r.json())
                                                .then((data) => { if (Array.isArray(data.data)) setNewChatGroups(data.data); })
                                                .catch(() => { })
                                                .finally(() => setNewChatGroupsLoading(false));
                                            } else {
                                              setSidebarError({ message: await getApiErrorMessage(res, 'Failed to delete group') });
                                            }
                                          } catch (err: unknown) {
                                            setSidebarError({ message: getErrorMessage(err, 'Error deleting group') });
                                          }
                                        }}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all hover:shadow-sm"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">Delete group</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* ── Contacts Section ── */}
                  {filteredContacts.length > 0 && (
                    <>
                      <div className="px-4 py-2 flex items-center justify-between">
                        <button
                          onClick={() => setContactsSectionExpanded(v => !v)}
                          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                          {contactsSectionExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          Contacts
                        </button>
                        <span className="text-[10px] text-muted-foreground">
                          {newChatContactsTotal > 0 ? newChatContactsTotal : filteredContacts.length}
                          {!contactsLoadedAll && newChatContactsTotal > 0 && (
                            <span className="text-amber-500 ml-1">({newChatContacts.length} loaded…)</span>
                          )}
                        </span>
                      </div>

                      {contactsSectionExpanded && filteredContacts.map((conv) => {
                        return (
                          <button
                            key={conv.id}
                            onClick={() => openChatFromNewContact(conv)}
                            className="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-muted dark:hover:bg-[#202c33] transition-colors"
                          >
                            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">
                              {(conv.contact?.name || '?')[0]?.toUpperCase()}
                            </div>
                            <div className="flex flex-col items-start overflow-hidden">
                              <span className="text-sm font-medium truncate w-full text-left">
                                {conv.contact?.name || conv.contact?.phone || 'Unknown'}
                              </span>
                              {conv.contact?.phone && conv.contact?.name && (
                                <span className="text-xs text-muted-foreground truncate w-full text-left">
                                  {conv.contact.phone}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* No results */}
                  {noResults && newChatSearch && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Search className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No contacts or groups found</p>
                    </div>
                  )}

                  {newChatGroupsLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {newChatContactsLoading && (
                    <p className="text-[10px] text-center text-muted-foreground py-2">Loading all contacts…</p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Bottom action bar — visible when items are selected */}
          {(selectedNewChatIds.size > 0 || selectedNewChatGroupIds.size > 0) && (
            <div className="px-4 py-3 border-t border-border dark:border-[#222d34] bg-card dark:bg-[#161717] flex items-center gap-2">
              <button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-9 rounded-md font-medium transition-colors"
                onClick={() => {
                  if (selectedNewChatGroupIds.size > 0) {
                    const selectedGroups = newChatGroups.filter(g => selectedNewChatGroupIds.has(g.id));
                    setIsNewChatOpen(false);
                    setNewChatSearch('');
                    setSelectedNewChatIds(new Set());
                    setSelectedNewChatGroupIds(new Set());
                    handleGroupsTemplateSend(selectedGroups);
                    return;
                  }
                  if (selectedNewChatIds.size === 1) {
                    const id = Array.from(selectedNewChatIds)[0];
                    setIsNewChatOpen(false);
                    setNewChatSearch('');
                    setSelectedNewChatIds(new Set());
                    setSelectedNewChatGroupIds(new Set());
                    onSelectConversation(id);
                    return;
                  }
                  const ids = Array.from(selectedNewChatIds);
                  setIsNewChatOpen(false);
                  setNewChatSearch('');
                  setSelectedNewChatIds(new Set());
                  setSelectedNewChatGroupIds(new Set());
                  setCreateGroupIds(ids);
                  setIsCreateGroupOpen(true);
                  onShowCreateGroupModal?.(ids);
                }}
              >
                {selectedNewChatGroupIds.size > 0 ? 'Send Broadcast' : selectedNewChatIds.size > 1 ? 'Create Group' : 'Open Chat'}
              </button>
              <button
                className="border border-border text-xs h-9 px-3 rounded-md hover:bg-muted transition-colors"
                onClick={() => {
                  setSelectedNewChatIds(new Set());
                  setSelectedNewChatGroupIds(new Set());
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Chat Group Manager Dialog ───────────────────────────────────── */}
      <ChatGroupManager
        open={isGroupManagerOpen}
        onOpenChange={setIsGroupManagerOpen}
        onSendTemplateToGroup={handleGroupTemplateSend}
        onSendTemplateToGroups={handleGroupsTemplateSend}
        onSelectGroup={(group) => {
          setIsGroupManagerOpen(false);
          handleGroupTemplateSend(group.id, group.conversation_count);
        }}
        channel={backendChannel}
      />

      {/* ── Template Picker Dialog ──────────────────────────────────────── */}
      <TemplatePicker
        open={isTemplatePickerOpen}
        onOpenChange={(open) => {
          setIsTemplatePickerOpen(open);
          if (!open) setGroupTemplateSendTarget(null);
        }}
        selectedCount={templatePickerCount}
        onSend={handleTemplateSend}
        sending={templateSending}
        sendProgress={templateSendProgress}
        channel={backendChannel ?? 'waba'}
        isBulkSend={!!groupTemplateSendTarget}
      />

      {/* ── Import Leads Dialog ─────────────────────────────────────────── */}
      <ImportLeadsDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        channel={backendChannel}
        onImportComplete={() => {
          onRefresh?.();
          setImportRefreshTrigger((prev) => prev + 1);
        }}
      />

      <CreateBroadcastGroupModal
        open={isCreateGroupOpen}
        onOpenChange={setIsCreateGroupOpen}
        selectedIds={createGroupIds}
        channel={backendChannel}
        onSuccess={() => {
          onRefresh?.();
          setCreateGroupIds([]);
        }}
      />

      {/* ── Broadcast schedule summary toast ───────────────────────────── */}
      {sendSummary && sendSummary.queued > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 bg-card border border-border shadow-xl rounded-xl px-4 py-3 max-w-sm w-full">
          <div className="text-green-500 mt-0.5">✓</div>
          <div className="flex-1 text-sm">
            <p className="font-semibold">Broadcast started</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Sent <strong>{sendSummary.sent}</strong> today.{' '}
              <strong>{sendSummary.queued}</strong> remaining scheduled across{' '}
              <strong>{sendSummary.scheduledDays}</strong> day{sendSummary.scheduledDays !== 1 ? 's' : ''} — continues at 9:00 AM daily.
            </p>
          </div>
          <button className="text-muted-foreground hover:text-foreground text-xs mt-0.5" onClick={() => setSendSummary(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* WABusinessView (Main Export)                                              */
/* ========================================================================= */

export function WABusinessView({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
}: {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
}) {
  const channel = 'personal';
  const queryClient = useQueryClient();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    conversations,
    selectedConversation,
    selectedId,
    selectConversation,
    searchQuery,
    setSearchQuery,
    sendMessage,
    muteConversation,
  } = useConversations({ channel });

  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(window.innerWidth < 1024);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(localSearchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [localSearchQuery, setSearchQuery]);

  const withChannel = useCallback(
    (url: string) => `${url}${url.includes('?') ? '&' : '?'}channel=${channel}`,
    [channel]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
  }, [queryClient]);

  const handleFavorite = useCallback(
    async (id?: string) => {
      if (!id) return;
      setActionError(null);
      try {
        const res = await fetchWithTenant(withChannel(`/api/whatsapp-conversations/conversations/${id}/favorite`), { method: 'PATCH' });
        if (!res.ok) {
          throw new Error(await getApiErrorMessage(res, 'Failed to update favorite status'));
        }
        invalidate();
      } catch (err) {
        setActionError(getErrorMessage(err, 'Failed to update favorite status'));
      }
    },
    [withChannel, invalidate]
  );

  const handleDelete = useCallback(
    async (id?: string) => {
      if (!id) return;
      setActionError(null);
      try {
        const res = await fetchWithTenant(withChannel(`/api/whatsapp-conversations/conversations/${id}`), { method: 'DELETE' });
        if (!res.ok) {
          throw new Error(await getApiErrorMessage(res, 'Failed to delete conversation'));
        }
        invalidate();
        if (selectedId === id) selectConversation('');
      } catch (err) {
        setActionError(getErrorMessage(err, 'Failed to delete conversation'));
      }
    },
    [withChannel, invalidate, selectedId, selectConversation]
  );

  const handleBlock = useCallback(
    async (id?: string) => {
      if (!id) return;
      setActionError(null);
      try {
        const res = await fetchWithTenant(withChannel(`/api/whatsapp-conversations/conversations/${id}/status`), {
          method: 'PATCH',
          body: JSON.stringify({ status: 'resolved' }),
        });
        if (!res.ok) {
          throw new Error(await getApiErrorMessage(res, 'Failed to update conversation status'));
        }
        invalidate();
      } catch (err) {
        setActionError(getErrorMessage(err, 'Failed to update conversation status'));
      }
    },
    [withChannel, invalidate]
  );

  const handleClear = useCallback(async (id: string) => { await handleDelete(id); }, [handleDelete]);

  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const toggleContextPanel = useCallback(() => setIsContextPanelOpen((p) => !p), []);
  const openContextPanel = useCallback(() => setIsContextPanelOpen(true), []);

  // ── Sort / filter state ────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<'date' | 'message_count' | 'name'>('date');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [contextStatusFilter, setContextStatusFilter] = useState('all');
  const [contextStatuses, setContextStatuses] = useState<ContextStatusOption[]>([]);

  useEffect(() => {
    fetchWithTenant(`/api/whatsapp-conversations/conversations/context-statuses?channel=${channel}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const statuses = (data.data as Array<{ value?: string; count?: number }>)
            .filter((s) => typeof s.value === 'string')
            .map((s) => ({
              value: s.value as string,
              label: formatContextStatus(s.value as string),
              count: Number(s.count || 0),
            }));
          setContextStatuses(
            statuses
          );
        }
      })
      .catch(() => { });
  }, [channel]);

  const typedConversations = useMemo(() => (conversations || []) as Conversation[], [conversations]);
  const typedSelectedConversation = useMemo(
    () => {
      if (isMobileViewport && !isMobileChatOpen) return null;
      return (selectedConversation?.id ? selectedConversation : null) as Conversation | null;
    },
    [isMobileChatOpen, isMobileViewport, selectedConversation]
  );

  useEffect(() => {
    if (!typedSelectedConversation && isContextPanelOpen) {
      setIsContextPanelOpen(false);
    }
  }, [typedSelectedConversation, isContextPanelOpen]);

  const { messages: polledMessages } = useConversationMessages(
    typedSelectedConversation?.id || null,
    { limit: 50 },
    channel || 'waba'
  );

  const activeLastMsg = polledMessages && polledMessages.length > 0
    ? polledMessages[polledMessages.length - 1]
    : null;

  return (
    <div className="flex-1 flex overflow-hidden bg-background min-w-0">
      {actionError && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm dark:border-red-800 dark:bg-red-950/70 dark:text-red-200 max-w-[calc(100%-1rem)]">
          <div className="flex items-center gap-3">
            <span>{actionError}</span>
            <button
              type="button"
              className="text-xs font-medium underline underline-offset-2"
              onClick={() => setActionError(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {/* Sidebar — desktop: controlled by isSidebarCollapsed; mobile: shown when no chat is selected */}
      <AnimatePresence mode="wait">
        {(!isSidebarCollapsed || (isMobileViewport && !typedSelectedConversation)) && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: isMobileViewport ? '100%' : 460, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "h-full flex-shrink-0 overflow-hidden border-r border-border dark:border-[#222d34] z-10 relative shadow-sm w-full lg:w-[460px] min-w-0",
              // Mobile: show sidebar only when no conversation is selected (same as LinkedIn)
              typedSelectedConversation ? "hidden lg:block" : "block lg:block"
            )}
          >
	            <WABASidebar
	              conversations={typedConversations}
		              selectedId={selectedId}
		              onSelectConversation={(id) => {
		                selectConversation(id);
		                setIsMobileChatOpen(true);
		                setIsSidebarCollapsed(false);
		              }}
	              searchQuery={localSearchQuery}
	              onSearchChange={setLocalSearchQuery}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              hideEmpty={hideEmpty}
              onHideEmptyChange={setHideEmpty}
              selectedLabelIds={selectedLabelIds}
              onLabelFilterChange={setSelectedLabelIds}
              contextStatusFilter={contextStatusFilter}
              onContextStatusFilterChange={setContextStatusFilter}
              contextStatuses={contextStatuses}
              backendChannel={channel}
              onRefresh={invalidate}
              activeLastMsg={activeLastMsg}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area — hidden on mobile when no conversation selected */}
      <div className={cn(
        "flex-1 overflow-hidden",
        !typedSelectedConversation ? "hidden lg:flex" : "flex"
      )}>
        <WABAChatWindow
          conversation={typedSelectedConversation}
          onSendMessage={sendMessage}
          onTogglePanel={openContextPanel}
          isPanelOpen={isContextPanelOpen}
		          onBack={() => {
                setIsContextPanelOpen(false);
		            selectConversation('');
		            setIsMobileChatOpen(false);
		            setIsSidebarCollapsed(false);
		          }}
          onDeleteChat={handleDelete}
          onBlockChat={handleBlock}
          onFavoriteChat={handleFavorite}
          onMuteChat={muteConversation}
          onClearChat={handleClear}
          onCloseChat={(_id: string) => selectConversation('')}
          channel={channel}
          conversationId={typedSelectedConversation?.id}
          owner={typedSelectedConversation?.owner}
          backendChannel={channel}
        />
      </div>

      {/* Context Panel (Contact Info) */}
      <AnimatePresence mode="wait">
        {isContextPanelOpen && typedSelectedConversation && (
          <>
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 420, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full flex-shrink-0 overflow-hidden hidden xl:block border-l border-border dark:border-[#222d34] z-10 relative shadow-sm"
            >
              <ConversationContextPanel
                conversation={typedSelectedConversation}
                onClose={toggleContextPanel}
                backendChannel={channel}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-0 bottom-0 top-14 z-40 xl:hidden"
            >
              <button
                type="button"
                aria-label="Close contact info panel"
                className="absolute inset-0 bg-black/40"
                onClick={toggleContextPanel}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-card dark:bg-[#161717] border-l border-border dark:border-[#222d34] shadow-xl"
              >
                <ConversationContextPanel
                  conversation={typedSelectedConversation}
                  onClose={toggleContextPanel}
                  backendChannel={channel}
                />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
