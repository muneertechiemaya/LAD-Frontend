import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { safeStorage } from '@lad/shared/storage';
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/chip';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  User as UserIcon, Mail, Phone, Clock, Paperclip, MessageSquare, FileText, GripVertical,
  Trash2, MoreVertical, Building2, DollarSign, Calendar, Flag, CheckCircle2,
  AlertCircle, TrendingUp, TrendingDown, X, Edit, Save, XCircle, Plus,
  UserCircle, UserStar, AlertTriangle, FolderTree, Ban, Sparkles, CheckCheck, Copy, Archive, Tag, Linkedin, Globe
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '@/services/api';
import * as leadsService from '@lad/frontend-features/deals-pipeline';
import { FileDown } from 'lucide-react';
import { getStatusLabel, humanizeKey } from '@/utils/statusMappings';
import { getTagConfig, type LeadTag } from '@/utils/leadCategorization';
import { getFieldValue } from '@/utils/fieldMappings';
import { formatDateTimeUnified } from '@/utils/dateTime';
import { selectStatuses, selectPriorities, selectSources } from '@/store/slices/masterDataSlice';
import { selectStages } from '@/features/deals-pipeline/store/slices/pipelineSlice';
import { updateLeadAction, deleteLeadAction } from '@/features/deals-pipeline/store/action/pipelineActions';
import type { Lead } from '@/features/deals-pipeline/types';
import {
  selectLeadCardActiveTab,
  selectLeadCardExpanded,
  selectLeadCardEditingOverview,
  selectLeadCardEditFormData,
  setLeadCardActiveTab,
  setLeadCardExpanded,
  setLeadCardEditingOverview,
  setLeadCardEditFormData,
  resetLeadCardEditFormData
} from '@/store/slices/uiSlice';
import {
  selectUsers,
  selectUsersLoading,
  selectUsersError,
  User
} from '@/store/slices/usersSlice';
import { fetchUsersAction } from '@/store/actions/usersActions';
import BookingSlot from './BookingSlot';
import LeadNextStep from './LeadNextStep';
import PipelineBadge from './PipelineBadge';
import * as bookingService from '@/services/bookingService';
import { selectUser as selectAuthUser } from '@/store/slices/authSlice';
interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  [key: string]: unknown;
}
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`lead-tabpanel-${index}`}
      aria-labelledby={`lead-tab-${index}`}
      {...other}
      className="h-full min-h-[500px] flex flex-col"
    >
      <div className="p-6 h-full overflow-auto flex flex-col">
        {children}
      </div>
    </div>
  );
};
const a11yProps = (index: number) => ({
  id: `lead-tab-${index}`,
  'aria-controls': `lead-tabpanel-${index}`,
});
interface Note {
  id: string | number;
  content: string;
  user_id?: string | number;
  user_name?: string;
  user_avatar?: string | null;
  created_at?: string;
}
interface Comment {
  text: string;
  id: string | number;
  content: string;
  user_id?: string | number;
  user_name?: string;
  user_avatar?: string | null;
  created_at?: string;
}
interface Attachment {
  id: string | number;
  name: string;
  size?: number;
  type?: string;
  user_id?: string | number;
  uploadedAt?: string;
}
interface AssignedUser {
  id: string | number;
  name: string;
  avatar?: string | null;
}
interface PipelineLeadCardProps {
  lead: Lead;
  isPreview?: boolean;
  onDelete?: (leadId: string | number) => Promise<void> | void;
  onEdit?: (lead: Lead) => void;
  currentStage?: number;
  totalStages?: number;
  onStatusChange?: (leadId: string | number, status: string) => Promise<void> | void;
  assignedUsers?: AssignedUser[];
  teamMembers?: User[];
  activityData?: number[];
  probability?: number;
  onAddNote?: (note: string) => Promise<void> | void;
  onAddComment?: (comment: string) => Promise<void> | void;
  onAddAttachment?: (file: File) => Promise<void> | void;
  onDeleteNote?: (noteId: string | number) => Promise<void> | void;
  onDeleteComment?: (commentId: string | number) => Promise<void> | void;
  onDeleteAttachment?: (attachmentId: string | number) => Promise<void> | void;
  externalDetailsOpen?: boolean | null;
  onExternalDetailsClose?: (() => void) | null;
  hideCard?: boolean;
}
/** A labelled row in the lead details: what the value is, then the value or a plain empty state. */
const InfoRow = ({ label, children, empty }: { label: string; children?: React.ReactNode; empty: string }) => (
  <div className="flex flex-col gap-0.5 min-w-0 sm:flex-row sm:items-start sm:gap-3">
    <span className="shrink-0 pt-0.5 text-xs font-medium text-gray-600 dark:text-slate-300 sm:w-24">{label}</span>
    <div className="min-w-0 flex-1 break-words text-sm text-gray-900 dark:text-white">
      {children || <span className="italic text-gray-500 dark:text-slate-400">{empty}</span>}
    </div>
  </div>
);
// RegExp constructor, not a /\p{L}/u literal: tsconfig targets ES2017.
const FIRST_LETTER = new RegExp('\\p{L}', 'u');
/** First letter of the name, upper-cased; null for names that are phone numbers (an icon shows instead of "+"). */
const getAvatarInitial = (name: string): string | null => {
  if (!name || name === 'Unnamed Lead') return null;
  const m = name.match(FIRST_LETTER);
  return m ? m[0].toLocaleUpperCase() : null;
};
const TEMPERATURE_DARK: Record<string, string> = {
  hot: 'dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  warm: 'dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  cold: 'dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
};
/** "category:cold" -> "Cold lead" in the call-log colours; any other tag humanised. */
const formatTag = (raw: unknown): { label: string; className: string } => {
  const rest = String(raw ?? '').replace(/^category:/i, '').trim();
  const temp = rest.match(/^(hot|warm|cold)(?:[\s_-]*lead)?$/i);
  if (temp) {
    const key = temp[1].toLowerCase() as LeadTag;
    const cfg = getTagConfig(key);
    return { label: `${cfg.label} lead`, className: `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor} ${TEMPERATURE_DARK[key]}` };
  }
  // Humanise only key-like tags ("not_interested"); free text stays as typed.
  const keyLike = /^[a-z0-9]+([_:-][a-z0-9]+)+$/i.test(rest);
  return { label: keyLike ? humanizeKey(rest) : rest, className: 'bg-white text-gray-700 border-gray-300 dark:bg-[#1a2a43] dark:text-slate-200 dark:border-[#3a4a6b]' };
};
const PipelineLeadCard: React.FC<PipelineLeadCardProps> = ({
  lead,
  isPreview = false,
  onDelete,
  onEdit,
  currentStage = 0,
  totalStages = 1,
  onStatusChange,
  assignedUsers = [],
  teamMembers = [],
  activityData = [],
  probability = 0,
  onAddNote,
  onAddComment,
  onAddAttachment,
  onDeleteNote,
  onDeleteComment,
  onDeleteAttachment,
  externalDetailsOpen = null,
  onExternalDetailsClose = null,
  hideCard = false
}) => {
  const { toast } = useToast();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const statusOptions = useSelector(selectStatuses);
  const priorityOptions = useSelector(selectPriorities);
  const sourceOptions = useSelector(selectSources);
  const stageOptions = useSelector(selectStages);
  const authUser = useSelector(selectAuthUser) as any;
  const createdBy = String(authUser?.id || authUser?._id || '');
  const tenantId = String(
    authUser?.tenantId ||
      authUser?.organizationId ||
      (lead as any)?.tenant_id ||
      (lead as any)?.organization_id ||
      ''
  );
  const assignedUserId = String(
    (lead as any)?.assigned_user_id ||
      (lead as any)?.assigned_to_id ||
      (lead as any)?.assigned_to ||
      createdBy ||
      ''
  );
  const studentId = String(
    (lead as any)?.student_id || (lead as any)?.studentId || (lead as any)?.student?.id || ''
  );
  // Get team members from global Redux state
  const globalTeamMembers = useSelector(selectUsers);
  const teamMembersLoading = useSelector(selectUsersLoading);
  const teamMembersError = useSelector(selectUsersError);
  // Get leadCard state from Redux
  const globalActiveTab = useSelector(selectLeadCardActiveTab);
  const globalExpanded = useSelector(selectLeadCardExpanded);
  const globalEditingOverview = useSelector(selectLeadCardEditingOverview);
  const globalEditFormData = useSelector(selectLeadCardEditFormData);
  // Use global team members if available, fallback to props for backward compatibility
  const effectiveTeamMembers = globalTeamMembers.length > 0 ? globalTeamMembers : teamMembers;
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Use external dialog control if provided, otherwise use internal state
  const isDetailsOpen = externalDetailsOpen !== null ? externalDetailsOpen : detailsOpen;
  const handleDetailsClose = onExternalDetailsClose || (() => setDetailsOpen(false));
  // Local states that should remain local (component-specific UI states)
  const [newNote, setNewNote] = useState<string>('');
  const [newComment, setNewComment] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: '', severity: 'success' });
  const snackbarClasses: Record<'success' | 'error' | 'info' | 'warning', string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-500 text-gray-900'
  };
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; type: string; id: string | number | null }>({ open: false, type: '', id: null });
  // Edit states for notes and comments
  const [editingNote, setEditingNote] = useState<{ id: string | number | null; content: string }>({ id: null, content: '' });
  const [editingComment, setEditingComment] = useState<{ id: string | number | null; content: string }>({ id: null, content: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggable, setIsDraggable] = useState(false);
  // Loading states for individual tabs
  const [notesLoading, setNotesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | number | null>(null);
  // Local state for current status to handle optimistic updates
  const [currentStatus, setCurrentStatus] = useState(lead.status);
  // Local states that remain component-specific
  const [newTagInput, setNewTagInput] = useState('');
  // "Book a meeting" from the Meetings box without switching the whole Overview into edit mode.
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  // Users state
  const [users, setUsers] = useState<Array<{
    id: string | number;
    name: string;
    email: string;
  }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const goalsArray = Array.isArray(lead.goals) ? lead.goals :
                    typeof lead.goals === 'string' && lead.goals.trim() !== '' ? [lead.goals] : [];
  const tagsArray = Array.isArray(lead.tags) ? lead.tags : [];
  const allTags = [...new Set([...goalsArray, ...tagsArray])];
  // Detect mobile using window width
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const cardRef = useRef<HTMLDivElement>(null);
  const ignoreNextCardClickRef = useRef(false);
  const leadNameRef = useRef<HTMLParagraphElement>(null);
  const leadNameScrollRafRef = useRef<number | null>(null);
  const leadNameScrollStateRef = useRef<{ direction: 'forward' | 'backward'; maxScroll: number; el: HTMLElement | null }>({ direction: 'forward', maxScroll: 0, el: null });

  const animateHorizontalScrollInfinite = useCallback((el: HTMLElement, maxScroll: number): void => {
    // Cancel any existing animation first
    if (leadNameScrollRafRef.current !== null) {
      cancelAnimationFrame(leadNameScrollRafRef.current);
      leadNameScrollRafRef.current = null;
    }

    // If there's nothing to scroll, don't animate
    if (maxScroll <= 0) {
      el.scrollLeft = 0;
      return;
    }

    leadNameScrollStateRef.current = { direction: 'forward', maxScroll, el };

    // Slower speed: duration for full travel (in ms) - increased for slower animation
    const durationMs = 2800;

    let lastTime: number | null = null;
    let progress = 0; // 0 to 1 for forward, 1 to 0 for backward

    const tick = (now: number) => {
      const state = leadNameScrollStateRef.current;
      if (state.el !== el) return; // stale callback

      if (lastTime === null) {
        lastTime = now;
      }

      const dt = now - lastTime;
      lastTime = now;

      // Update progress based on direction
      if (state.direction === 'forward') {
        progress += dt / durationMs;
        if (progress >= 1) {
          progress = 1;
          state.direction = 'backward';
        }
      } else {
        progress -= dt / durationMs;
        if (progress <= 0) {
          progress = 0;
          state.direction = 'forward';
        }
      }

      // Ease in-out for smooth feel
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      el.scrollLeft = eased * maxScroll;

      // Continue animation
      leadNameScrollRafRef.current = requestAnimationFrame(tick);
    };

    leadNameScrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopHorizontalScroll = useCallback((el: HTMLElement): void => {
    if (leadNameScrollRafRef.current !== null) {
      cancelAnimationFrame(leadNameScrollRafRef.current);
      leadNameScrollRafRef.current = null;
    }
    // Smoothly return to start
    const from = el.scrollLeft;
    const durationMs = 600;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      el.scrollLeft = from * (1 - eased);
      if (t < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (leadNameScrollRafRef.current !== null) {
        cancelAnimationFrame(leadNameScrollRafRef.current);
      }
    };
  }, []);
  // Critical: Don't disable sortable - use handle strategy instead to prevent re-initialization issues
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(lead.id),
    data: { type: 'lead', lead },
    disabled: isPreview // Only disable for preview, NOT for dialog state
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition as string,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    userSelect: 'none' as const,
  };
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleCardClick(event as unknown as React.MouseEvent);
    }
  };
  const handleTouchStart = () => undefined;
  const handleDragHandleMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsDraggable(true);
  };
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggable(false);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  // Load team members via Redux when component mounts
  useEffect(() => {
    if (globalTeamMembers.length === 0 && !teamMembersLoading && !teamMembersError) {
      dispatch(fetchUsersAction() as any);
    }
  }, [dispatch, globalTeamMembers, teamMembersLoading, teamMembersError]); // Remove dependency on globalTeamMembers.length to prevent infinite loops
  // Initialize Redux editFormData when lead changes - but never while someone is
  // editing: the form is shared by every card, and Edit Lead (handleStartEdit)
  // always loads it fresh from the lead being edited.
  useEffect(() => {
    if (lead && !globalEditingOverview) {
      // Convert Lead to Partial<Lead> with proper type conversions
      const leadForForm: Partial<Lead> = {
        ...lead,
        amount: typeof lead.amount === 'string' ? parseFloat(lead.amount) || null : lead.amount
      };
      dispatch(resetLeadCardEditFormData(leadForForm));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, dispatch]);
  // Every time this lead's dialog opens, start in view mode. The edit flag is
  // global and can be left on (e.g. leaving the page mid-edit); opening another
  // lead in edit mode would show and save the previous lead's form.
  const wasDetailsOpenRef = useRef(false);
  useEffect(() => {
    if (isDetailsOpen && !wasDetailsOpenRef.current) {
      dispatch(setLeadCardEditingOverview(false));
    }
    wasDetailsOpenRef.current = isDetailsOpen;
  }, [isDetailsOpen, dispatch]);
  useEffect(() => () => {
    // Unmounted while open (route change mid-edit): don't leave edit mode on.
    if (wasDetailsOpenRef.current) dispatch(setLeadCardEditingOverview(false));
  }, [dispatch]);
  // Sync local status with prop changes
  useEffect(() => {
    setCurrentStatus(lead.status);
  }, [lead.status]);
  // Load tab data when dialog opens or tab changes
  useEffect(() => {
    if (isDetailsOpen) {
      loadTabData(globalActiveTab);
    }
  }, [isDetailsOpen, globalActiveTab]);
  // Fetch users from API only once and only when needed
  useEffect(() => {
    // Skip if users are already loaded from Redux or component state
    if (users.length > 0 || globalTeamMembers.length > 0 || usersLoading) {
      return;
    }
    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        const fetchedUsers = await bookingService.fetchUsers();
        setUsers(fetchedUsers);
        } catch (error) {
        console.error('[PipelineLeadCard] Error loading users:', error);
        // Keep empty array on error
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, []); // Only run once on mount
  // Load data for specific tab
  const loadTabData = async (tabIndex: number) => {
    if (!lead.id) return;
    try {
      switch (tabIndex) {
        case 1: // Notes tab
          if (notes.length === 0) {
            setNotesLoading(true);
            const fetchedNotes = await leadsService.getLeadNotes(lead.id);
            setNotes(fetchedNotes as Note[]);
          }
          break;
        case 2: // Comments tab
          if (comments.length === 0) {
            setCommentsLoading(true);
            const fetchedComments = await leadsService.getLeadComments(lead.id);
            const normalizedComments = Array.isArray(fetchedComments)
              ? fetchedComments
              : (fetchedComments as any)?.comments || (fetchedComments as any)?.data || [];
            setComments((Array.isArray(normalizedComments) ? normalizedComments : []) as Comment[]);
          }
          break;
        case 3: // Attachments tab
          if (attachments.length === 0) {
            setAttachmentsLoading(true);
            const fetched = await leadsService.getLeadAttachments(lead.id);
            const fetchedAttachments = Array.isArray(fetched)
              ? fetched
              : (fetched as any)?.attachments || (fetched as any)?.data || (fetched as any)?.result || [];
            setAttachments((Array.isArray(fetchedAttachments) ? fetchedAttachments : []) as Attachment[]);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error loading tab ${tabIndex} data:`, error);
      showSnackbar(`Failed to load ${['overview', 'notes', 'comments', 'attachments'][tabIndex]}`, 'error');
    } finally {
      setNotesLoading(false);
      setCommentsLoading(false);
      setAttachmentsLoading(false);
    }
  };
//   useEffect(() => {
//   const fetchComments = async () => {
//     try {
//       const res = await axios.get(`/api/leads/${lead.id}/comments`);
//       setComments(res.data);
//     } catch (err) {
//       console.error('Failed to fetch comments:', err);
//     }
//   };
//   fetchComments();
// }, [lead.id]);
// Fetch comments
  // Memoize click handler to prevent stale closures and unnecessary re-renders
  const handleCardClick = useCallback((event?: React.MouseEvent) => {
    if (!event) return;
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false;
      return;
    }
    // Prevent click if event happened during drag
    if (isDragging || isDraggable) {
      return;
    }
    const target = event.target as HTMLElement;
    // Only ignore clicks on interactive elements (buttons, dropdowns) and drag handle
    if (
      target.closest('[data-ignore-card-click]') ||
      target.closest('[role="dialog"]') ||
      target.closest('.drag-handle') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'INPUT'
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dispatch(setLeadCardEditingOverview(false));
    setDetailsOpen(true);
  }, [isDragging, isDraggable, lead.id, dispatch]);
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
  };
  // Get current user from token or auth context
  const getCurrentUserId = () => {
    try {
      const token = safeStorage.getItem('token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.id;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  };
  // Check if current user can edit/delete item
  const canUserModify = (itemUserId?: string | number | null): boolean => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId || itemUserId === null || itemUserId === undefined) return false;
    return currentUserId === itemUserId || currentUserId.toString() === itemUserId.toString();
  };
  const handleDeleteConfirmationOpen = (type: string, id: string | number, userId?: string | number | null) => {
    // Check user permissions
    if (!canUserModify(userId)) {
      showSnackbar('You can only delete your own items.', 'error');
      return;
    }
    setDeleteConfirmation({ open: true, type, id });
  };
  const handleDeleteConfirmationClose = () => {
    setDeleteConfirmation({ open: false, type: '', id: null });
  };
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsLoading(true);
    try {
      const newNoteObj = await leadsService.addLeadNote(lead.id, newNote.trim());
      setNotes([newNoteObj as Note, ...notes]);
      setNewNote('');
      showSnackbar('Note added successfully', 'success');
    } catch (error) {
      console.error('Failed to add note:', error);
      const err = error as Error;
      showSnackbar(err.message || 'Failed to add note', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsLoading(true);
    try {
      const newCommentObj = await leadsService.addLeadComment(lead.id, newComment.trim());
      setComments([newCommentObj as Comment, ...comments]);
      setNewComment('');
      showSnackbar('Comment added successfully', 'success');
    } catch (error) {
      console.error('Failed to add comment:', error);
      const err = error as Error;
      showSnackbar(err.message || 'Failed to add comment', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const created = await leadsService.uploadLeadAttachment(lead.id, file);
      const normalized =
        (created as any)?.attachment?.db || (created as any)?.attachment || (created as any);
      setAttachments([normalized as Attachment, ...attachments]);
      showSnackbar('File uploaded successfully', 'success');
    } catch (error) {
      console.error('Failed to upload file:', error);
      const err = error as Error;
      showSnackbar(err.message || 'Failed to upload file', 'error');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  const resolveAttachmentNameAndUrl = (raw: any): { filename: string; url: string } => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    const filename =
      raw?.file_name ||
      raw?.filename ||
      raw?.name ||
      raw?.db?.file_name ||
      raw?.file?.originalName ||
      raw?.originalName ||
      'Untitled';
    const fileUrlPath =
      raw?.url ||
      raw?.file_url ||
      raw?.file_path ||
      raw?.db?.file_url ||
      '';
    const url = typeof fileUrlPath === 'string' && fileUrlPath
      ? (fileUrlPath.startsWith('http')
          ? fileUrlPath
          : `${apiBaseUrl}${fileUrlPath.startsWith('/') ? '' : '/'}${fileUrlPath}`)
      : '';
    return { filename: String(filename), url };
  };
  const handleDownloadAttachment = async (rawAttachment: any) => {
    const { filename } = resolveAttachmentNameAndUrl(rawAttachment as any);
    const fileUrl = rawAttachment?.file_url ?? rawAttachment?.db?.file_url ?? rawAttachment?.url ?? null;

    if (!fileUrl) {
      showSnackbar('Attachment URL missing', 'error');
      return;
    }

    const attachmentId = rawAttachment?.id ?? rawAttachment?.db?.id ?? null;
    setDownloadingAttachmentId(attachmentId);

    try {
      // Use the new SDK API to get signed URL and download
      await leadsService.downloadAttachment(lead.id, fileUrl, filename || 'download');
      showSnackbar('Download started', 'success');
    } catch (error) {
      const err = error as Error;
      console.error('Failed to download attachment:', err);
      showSnackbar(err.message || 'Failed to download attachment', 'error');
    } finally {
      setDownloadingAttachmentId(null);
    }
  };
  const handleDeleteNote = async (noteId: string | number) => {
    try {
      setIsLoading(true);
      await leadsService.deleteLeadNote(lead.id, noteId);
      setNotes(notes.filter(note => note.id !== noteId));
      showSnackbar('Note deleted successfully', 'success');
      } catch (error) {
      console.error('Failed to delete note:', error);
      const err = error as Error;
      showSnackbar(`Failed to delete note: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
    setDeleteConfirmation({ open: false, type: '', id: null });
  };
  const handleDeleteComment = async (commentId: string | number) => {
    try {
      setIsLoading(true);
      await leadsService.deleteLeadComment(lead.id, commentId);
      setComments(comments.filter(comment => comment.id !== commentId));
      showSnackbar('Comment deleted successfully', 'success');
      } catch (error) {
      console.error('Failed to delete comment:', error);
      const err = error as Error;
      showSnackbar(`Failed to delete comment: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
    setDeleteConfirmation({ open: false, type: '', id: null });
  };
  const handleDeleteAttachment = async (attachmentId: string | number) => {
    try {
      setIsLoading(true);
      await leadsService.deleteLeadAttachment(lead.id, attachmentId);
      setAttachments(attachments.filter(attachment => attachment.id !== attachmentId));
      showSnackbar('Attachment deleted successfully', 'success');
      } catch (error) {
      console.error('Failed to delete attachment:', error);
      const err = error as Error;
      showSnackbar(`Failed to delete attachment: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
    setDeleteConfirmation({ open: false, type: '', id: null });
  };
  // Edit handlers for notes and comments
  const handleEditNote = (note: Note) => {
    // Check user permissions
    if (!canUserModify(note.user_id)) {
      showSnackbar('You can only edit your own items.', 'error');
      return;
    }
    setEditingNote({ id: note.id, content: note.content });
  };
  const handleCancelEditNote = () => {
    setEditingNote({ id: null, content: '' });
  };
  const handleSaveEditNote = async () => {
    if (!editingNote.content.trim()) return;
    try {
      setIsLoading(true);
      const updatedNote = await leadsService.updateLeadNote(lead.id, editingNote.id!, editingNote.content.trim());
      setNotes(notes.map(note => note.id === editingNote.id ? (updatedNote as Note) : note));
      showSnackbar('Note updated successfully', 'success');
      setEditingNote({ id: null, content: '' });
    } catch (error) {
      console.error('Failed to update note:', error);
      const err = error as Error;
      showSnackbar(`Failed to update note: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleEditComment = (comment: Comment) => {
    // Check user permissions
    if (!canUserModify(comment.user_id)) {
      showSnackbar('You can only edit your own items.', 'error');
      return;
    }
    setEditingComment({ id: comment.id, content: comment.content });
  };
  const handleCancelEditComment = () => {
    setEditingComment({ id: null, content: '' });
  };
  const handleSaveEditComment = async () => {
    if (!editingComment.content.trim()) return;
    try {
      setIsLoading(true);
      const updatedComment = await leadsService.updateLeadComment(lead.id, editingComment.id!, editingComment.content.trim());
      setComments(comments.map(comment => comment.id === editingComment.id ? (updatedComment as Comment) : comment));
      showSnackbar('Comment updated successfully', 'success');
      setEditingComment({ id: null, content: '' });
    } catch (error) {
      console.error('Failed to update comment:', error);
      const err = error as Error;
      showSnackbar(`Failed to update comment: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleStatusChange = async (status: string) => {
    // Optimistic update - update UI immediately
    setCurrentStatus(status as Lead['status']);
    try {
      // Call the parent's status change handler
      if (onStatusChange) {
        await onStatusChange(lead.id, status);
      }
      // Use global snackbar for status updates
      showSnackbar('Status updated successfully', 'success');
    } catch (error) {
      // Revert the optimistic update on error
      setCurrentStatus(lead.status);
      showSnackbar('Failed to update status', 'error');
    }
  };
  // Overview tab edit handlers
  const handleStartEdit = () => {
    dispatch(setLeadCardEditingOverview(true));
    // Use getFieldValue helper to get values from lead object
    const formData = {
      // Lead Information
      email: String(getFieldValue<string>(lead, 'email') || ''),
      phone: String(getFieldValue<string>(lead, 'phone') || ''),
      company: String(
        getFieldValue<string>(lead, 'company') ||
          (lead as any).company_name ||
          (lead as any)?.raw_data?.company_name ||
          (lead as any)?.raw_data?._full_data?.company_name ||
          (lead as any)?.raw_data?._full_data?.organization?.name ||
          ''
      ),
      assignee: String(getFieldValue<string>(lead, 'assignee') || getFieldValue<string>(lead, 'assigned_to_id') || ''),
      source: String(getFieldValue<string>(lead, 'source') || ''),
      // Pipeline Information
      status: String(getFieldValue<string>(lead, 'status') || ''),
      priority: String(getFieldValue<string>(lead, 'priority') || ''),
      stage: String(getFieldValue<string>(lead, 'stage') || ''),
      // Deal Information
      amount: String(getFieldValue<number | string>(lead, 'amount') || ''),
      closeDate: String(getFieldValue<string>(lead, 'closeDate') || getFieldValue<string>(lead, 'close_date') || ''),
      expectedCloseDate: String(getFieldValue<string>(lead, 'expectedCloseDate') || getFieldValue<string>(lead, 'expected_close_date') || ''),
      // Description and Tags
      description: String(getFieldValue<string>(lead, 'description') || ''),
      tags: (lead.tags as string[]) || []
    };
    dispatch(setLeadCardEditFormData(formData));
  };
  const handleCancelEdit = () => {
    dispatch(setLeadCardEditingOverview(false));
    setNewTagInput(''); // Reset tag input
    // Reset form data to original lead values using getFieldValue helper
    const originalFormData = {
      // Lead Information
      email: String(getFieldValue<string>(lead, 'email') || ''),
      phone: String(getFieldValue<string>(lead, 'phone') || ''),
      company: String(
        getFieldValue<string>(lead, 'company') ||
          (lead as any).company_name ||
          (lead as any)?.raw_data?.company_name ||
          (lead as any)?.raw_data?._full_data?.company_name ||
          (lead as any)?.raw_data?._full_data?.organization?.name ||
          ''
      ),
      assignee: String(getFieldValue<string>(lead, 'assignee') || getFieldValue<string>(lead, 'assigned_to_id') || ''),
      source: String(getFieldValue<string>(lead, 'source') || ''),
      // Pipeline Information
      status: String(getFieldValue<string>(lead, 'status') || ''),
      priority: String(getFieldValue<string>(lead, 'priority') || ''),
      stage: String(getFieldValue<string>(lead, 'stage') || ''),
      // Deal Information
      amount: String(getFieldValue<number | string>(lead, 'amount') || ''),
      closeDate: String(getFieldValue<string>(lead, 'closeDate') || getFieldValue<string>(lead, 'close_date') || ''),
      expectedCloseDate: String(getFieldValue<string>(lead, 'expectedCloseDate') || getFieldValue<string>(lead, 'expected_close_date') || ''),
      // Description and Tags
      description: String(getFieldValue<string>(lead, 'description') || ''),
      tags: (lead.tags as string[]) || []
    };
    dispatch(setLeadCardEditFormData(originalFormData));
  };
  const handleSaveEdit = async () => {
    setIsLoading(true);
    try {
      const amountRaw = (globalEditFormData as any).amount;
      const parsedAmount =
        amountRaw === '' || amountRaw === null || amountRaw === undefined
          ? undefined
          : Number(amountRaw);
      const amount = Number.isFinite(parsedAmount as number) ? (parsedAmount as number) : undefined;
      const { amount: _ignoredAmount, ...restFormData } = (globalEditFormData as any) || {};
      // Prepare update data with proper field mapping
      const updateData = {
        ...restFormData,
        amount,
        // Ensure proper field mapping for backend (snake_case)
        assigned_to_id: globalEditFormData.assignee,
        close_date: globalEditFormData.closeDate,
        expected_close_date: globalEditFormData.expectedCloseDate
      };
      // Remove empty string values to avoid overwriting with empty data
      Object.keys(updateData).forEach((key: string) => {
        if ((updateData as Record<string, unknown>)[key] === '') {
          delete (updateData as Record<string, unknown>)[key];
        }
      });
      // Use Redux action instead of direct API call
      await dispatch(updateLeadAction(lead.id, updateData as Partial<Lead>) as any);
      // The list view renders a fetched page; refresh it so the row shows the save.
      void queryClient.invalidateQueries({ queryKey: ['deals-pipeline', 'pipeline', 'leads'] });
      dispatch(setLeadCardEditingOverview(false));
      setNewTagInput(''); // Reset tag input on successful save
      showSnackbar('Lead updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update lead:', error);
      const err = error as Error;
      showSnackbar(`Failed to update lead: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleFormFieldChange = (field: string, value: unknown) => {
    dispatch(setLeadCardEditFormData({
      ...globalEditFormData,
      [field]: value
    }));
  };
  // Tag management functions
  const handleAddTag = (newTag: string) => {
    if (newTag.trim() && !globalEditFormData.tags.includes(newTag.trim())) {
      handleFormFieldChange('tags', [...globalEditFormData.tags, newTag.trim()]);
    }
  };
  const handleRemoveTag = (tagToRemove: string) => {
    handleFormFieldChange('tags', globalEditFormData.tags.filter(tag => tag !== tagToRemove));
  };
  // Helper function to get assignee name
  const getAssigneeName = (assigneeId?: string | number | null): string => {
    if (!assigneeId) return 'Unassigned';
    if (teamMembersLoading) {
      return `Loading...`;
    }
    if (effectiveTeamMembers.length === 0 || teamMembersError) {
      // The team list didn't load; that doesn't mean the person left.
      return "Name didn't load";
    }
    const member = effectiveTeamMembers.find(m => {
      const matches = [
        m.id === assigneeId,
        m._id === assigneeId,
        String(m.id) === String(assigneeId),
        String(m._id) === String(assigneeId)
      ];
      return matches.some(match => match);
    });
    return member?.name || 'Former teammate';
  };
  // Helper function to get field value with fallback (local override)
  const getFieldValueLocal = (obj: unknown, field: string): string => {
    if (!obj || typeof obj !== 'object') return '';
    const objRecord = obj as Record<string, unknown>;
    return String(objRecord[field] || objRecord[field.replace(/([A-Z])/g, '_$1').toLowerCase()] || '');
  };
  const normalizeDisplayValue = (value: unknown, fallback = '-'): string => {
    if (value === null || value === undefined) return fallback;
    const asString = String(value).trim();
    if (!asString || asString === 'null' || asString === 'undefined') return fallback;
    return asString;
  };
  const getLeadDisplayName = (leadObj: any): string => {
    const name = normalizeDisplayValue(leadObj?.name, '').trim();
    if (name) return name;
    const firstName = normalizeDisplayValue(leadObj?.first_name ?? leadObj?.firstName, '').trim();
    const lastName = normalizeDisplayValue(leadObj?.last_name ?? leadObj?.lastName, '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
    const contactName = normalizeDisplayValue(leadObj?.contact_name ?? leadObj?.contactName, '').trim();
    if (contactName) return contactName;
    const email = normalizeDisplayValue(leadObj?.email, '').trim();
    if (email) return email;
    return 'Unnamed Lead';
  };
  // Helper function to format date for input fields
  const formatDateForInput = (dateString?: string | Date | null): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch (error) {
      return '';
    }
  };
  // Helper function to get display label for options
  const getOptionLabel = (options: Array<{ key: string; label: string }>, key?: string): string => {
    const option = options.find(opt => opt.key === key);
    return option?.label ?? key ?? '';
  };
  // Readable label for a stored key, even when the key isn't in the option list.
  const labelFor = (options: Array<{ key: string; label: string }>, key?: unknown): string => {
    const k = normalizeDisplayValue(key, '');
    if (!k) return '';
    return options.find(opt => String(opt.key) === k)?.label || humanizeKey(k);
  };
  // Keep the current value selectable in edit mode (a 'success' status or a LinkedIn
  // source made the select show blank). Display only; the saved value is unchanged.
  const withCurrent = (options: Array<{ key: string; label: string }>, current: unknown, label: string) => {
    const k = normalizeDisplayValue(current, '');
    return k && !options.some(opt => String(opt.key) === k) ? [...options, { key: k, label }] : options;
  };
  const formatCurrency = (amount?: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : (amount || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(numAmount);
  };
  const getProgressValue = (): number => {
    return ((currentStage + 1) / totalStages) * 100;
  };
  const getDaysRemaining = (): number | null => {
    const closeDate = getFieldValueLocal(lead, 'closeDate');
    if (!closeDate) return null;
    try {
      const closeDateObj = new Date(closeDate);
      if (isNaN(closeDateObj.getTime())) return null;
      const today = new Date();
      const diffTime = closeDateObj.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return null;
    }
  };
  const getStatusColor = (status?: string | null): string => {
    switch (status?.toLowerCase()) {
      case 'active': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'blocked': return '#EF4444';
      case 'inactive': return '#64748B';
      case 'new': return '#3B82F6';
      case 'completed':
      case 'success': return '#059669';
      case 'scheduled': return '#3B82F6';
      default: return '#64748B';
    }
  };
  const getProbabilityColor = (prob: number): string => {
    if (prob >= 70) return '#10B981';
    if (prob >= 40) return '#F59E0B';
    return '#EF4444';
  };
  const getStatusIcon = (status?: string | null): React.ReactElement => {
    const iconClass = "h-4 w-4";
    switch (status?.toLowerCase()) {
      case 'active': return <CheckCircle2 className={iconClass} />;
      case 'blocked': return <AlertCircle className={iconClass} />;
      case 'pending': return <Flag className={iconClass} />;
      case 'inactive': return <Ban className={iconClass} />;
      case 'new': return <Sparkles className={iconClass} />;
      case 'completed':
      case 'success': return <CheckCheck className={iconClass} />;
      case 'scheduled': return <Calendar className={iconClass} />;
      default: return <Flag className={iconClass} />;
    }
  };
  const getActivityTrend = (): number => {
    if (!activityData.length || activityData.length < 2) return 0;
    const recent = activityData.slice(-2);
    return (recent[1] || 0) - (recent[0] || 0);
  };
  const handleClose = () => {
    // Leave edit mode on close: the flag and form are global, so the next lead
    // opened would otherwise start in edit mode with this lead's data, and Save
    // would write it onto that lead.
    dispatch(setLeadCardEditingOverview(false));
    setBookingFormOpen(false);
    if (onExternalDetailsClose) {
      onExternalDetailsClose();
    } else {
      setDetailsOpen(false);
    }
    dispatch(setLeadCardExpanded(false));
    setNewNote('');
    setNewComment('');
    dispatch(setLeadCardActiveTab(0));
  };
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    toast({
      title: message,
      description: '',
      variant: severity === 'error' ? 'destructive' : 'default'
    });
  };
  const handleConfirmDelete = async () => {
    const { type, id } = deleteConfirmation;
    if (type && id) {
      // Handle item deletion (note, comment, attachment)
      switch (type) {
        case 'note':
          await handleDeleteNote(id);
          break;
        case 'comment':
          await handleDeleteComment(id);
          break;
        case 'attachment':
          await handleDeleteAttachment(id);
          break;
        default:
          break;
      }
    } else {
      // Handle lead deletion
      if (onDelete) {
        setIsLoading(true);
        try {
          await onDelete(lead.id);
          setDeleteDialogOpen(false);
          showSnackbar('Lead deleted successfully', 'success');
        } catch (error) {
          showSnackbar('Failed to delete lead', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };
  const handleTabChange = (newValue: string) => {
    dispatch(setLeadCardActiveTab(parseInt(newValue)));
  };
  const tabs: Array<{ label: string; count?: number; index: number; content: React.ReactNode }> = [
    {
      label: 'Overview',
      index: 0,
      content: (
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* What's happening with this lead and what's next. Mounted only here (open
              dialog, Overview tab), never per card, so the board makes no extra calls. */}
          {!globalEditingOverview && <LeadNextStep leadId={lead.id} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Lead Information Section */}
            <div className="p-4 bg-gray-50 dark:bg-[#253456] rounded-lg">
              <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-white">
                Lead details
              </h3>
              <div className="flex flex-col gap-4">
                {globalEditingOverview ? (
                  <>
                    <div className="relative">
                      <Label htmlFor="email" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          value={globalEditFormData.email || ''}
                          onChange={(e) => handleFormFieldChange('email', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <Label htmlFor="phone" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          type="tel"
                          value={globalEditFormData.phone || ''}
                          onChange={(e) => handleFormFieldChange('phone', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <Label htmlFor="company" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Company</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="company"
                          value={globalEditFormData.company || ''}
                          onChange={(e) => handleFormFieldChange('company', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="assignee" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Assigned to</Label>
                      <Select
                        value={globalEditFormData.assignee || 'unassigned'}
                        onValueChange={(value: string) => handleFormFieldChange('assignee', value === 'unassigned' ? '' : value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a teammate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {effectiveTeamMembers.map((member) => {
                            const memberId = String(member.id || '');
                            if (!memberId) return null;
                            return (
                              <SelectItem key={member.id} value={memberId}>
                                {member.name || member.email || 'Unknown'}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="source" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Lead source</Label>
                      <Select
                        value={globalEditFormData.source || undefined}
                        onValueChange={(value: string) => handleFormFieldChange('source', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                        <SelectContent>
                          {withCurrent(sourceOptions, globalEditFormData.source, labelFor(sourceOptions, globalEditFormData.source))
                            .filter((option) => option.key && String(option.key).trim() !== '')
                            .map((option) => (
                              <SelectItem key={option.key} value={String(option.key)}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="group flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
                      <span className="w-full shrink-0 text-xs font-medium text-gray-600 dark:text-slate-300 sm:w-24">Email</span>
                      <span
                        className="text-sm text-gray-900 dark:text-white truncate flex-1 min-w-0"
                        title={normalizeDisplayValue(lead.email, '')}
                      >
                        {normalizeDisplayValue(lead.email, '') || <span className="italic text-gray-500 dark:text-slate-400">No email yet</span>}
                      </span>
                      {!!lead.email && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await navigator.clipboard.writeText(lead.email as string);
                              toast({
                                title: 'Copied!',
                                description: 'Email copied to clipboard'
                              });
                            } catch {
                              toast({
                                title: 'Copy failed',
                                description: 'Unable to copy email'
                              });
                            }
                          }}
                          className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity inline-flex items-center justify-center p-1 max-lg:min-h-11 max-lg:min-w-11 rounded shrink-0 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1a2a43]"
                          title="Copy email"
                          aria-label="Copy email"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <InfoRow label="Phone" empty="No phone yet">
                      {normalizeDisplayValue(lead.phone, '') && (
                        <a href={`tel:${normalizeDisplayValue(lead.phone, '').replace(/[^\d+]/g, '')}`} className="hover:underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">
                          {normalizeDisplayValue(lead.phone, '')}
                        </a>
                      )}
                    </InfoRow>
                    <InfoRow label="Company" empty="No company yet">
                      {normalizeDisplayValue(
                        (
                          lead.company ||
                          (lead as any).company_name ||
                          (lead as any)?.raw_data?.company_name ||
                          (lead as any)?.raw_data?._full_data?.company_name ||
                          (lead as any)?.raw_data?._full_data?.organization?.name
                        ) as unknown,
                        ''
                      )}
                    </InfoRow>
                    {normalizeDisplayValue(
                      (
                        (lead as any).title ??
                        (lead as any)?.raw_data?._full_data?.title ??
                        (lead as any)?.raw_data?.title
                      ) as unknown,
                      ''
                    ) && (
                      <InfoRow label="Job title" empty="">
                        {normalizeDisplayValue(
                          (
                            (lead as any).title ??
                            (lead as any)?.raw_data?._full_data?.title ??
                            (lead as any)?.raw_data?.title
                          ) as unknown
                        )}
                      </InfoRow>
                    )}
                    <InfoRow label="Assigned to" empty="Unassigned">
                      {getAssigneeName((lead.assignee || lead.assigned_to_id) as string | number | null | undefined)}
                    </InfoRow>
                    <div className="flex flex-col gap-0.5 min-w-0 sm:flex-row sm:items-center sm:gap-3">
                      <span className="shrink-0 text-xs font-medium text-gray-600 dark:text-slate-300 sm:w-24">Lead source</span>
                      {/* <AlertTriangle className="h-4 w-4 text-gray-500 dark:text-slate-300" /> */}
                      {(() => {
                        const sourceKey = String((lead as any)?.source || '').toLowerCase();

                        // Map sources based on requirements
                        const isVoiceAgent = sourceKey === 'voice_agent';
                        const isWebsite = sourceKey === 'website';
                        const isLinkedin =
                          sourceKey.includes('linkedin') ||
                          sourceKey === 'inbound_upload' ||
                          sourceKey === 'direct_contact' ||
                          sourceKey === 'linkedin';

                        let label = 'Unknown';
                        let icon = null;
                        let className = 'inline-flex items-center gap-2 rounded-full bg-gray-50 dark:bg-[#253456] text-gray-700 dark:text-white border border-gray-200 dark:border-[#262831] px-3 py-1 text-xs font-medium';

                        if (isLinkedin) {
                          label = 'LinkedIn';
                          icon = <Linkedin className="h-4 w-4" />;
                          className = 'inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 px-3 py-1 text-xs font-medium';
                        } else if (isVoiceAgent) {
                          label = 'Voice Agent';
                          icon = <Phone className="h-4 w-4" />;
                          className = 'inline-flex items-center gap-2 rounded-full bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900 px-3 py-1 text-xs font-medium';
                        } else if (isWebsite) {
                          label = 'Website';
                          icon = <Globe className="h-4 w-4" />;
                          className = 'inline-flex items-center gap-2 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900 px-3 py-1 text-xs font-medium';
                        } else if (sourceKey && sourceKey !== 'unknown') {
                          label = labelFor(sourceOptions, (lead as any)?.source);
                        }

                        return (
                          <span className="text-gray-900 dark:text-white">
                            <span className={className}>
                              {icon}
                              {label}
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Pipeline & Deal Information Section */}
            <div className="p-4 bg-gray-50 dark:bg-[#253456] rounded-lg">
              <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-white">
                Pipeline
              </h3>
              <div className="flex flex-col gap-4">
                {globalEditingOverview ? (
                  <>
                    <div>
                      <Label htmlFor="status" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Status</Label>
                      <Select
                        value={globalEditFormData.status || undefined}
                        onValueChange={(value: string) => handleFormFieldChange('status', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent>
                          {withCurrent(statusOptions, globalEditFormData.status, getStatusLabel(normalizeDisplayValue(globalEditFormData.status, ''), statusOptions as any))
                            .filter((option) => option.key && String(option.key).trim() !== '')
                            .map((option) => (
                              <SelectItem key={option.key} value={String(option.key)}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="priority" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Priority</Label>
                      <Select
                        value={globalEditFormData.priority || undefined}
                        onValueChange={(value: string) => handleFormFieldChange('priority', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select priority..." />
                        </SelectTrigger>
                        <SelectContent>
                          {withCurrent(priorityOptions, globalEditFormData.priority, labelFor(priorityOptions, globalEditFormData.priority))
                            .filter((option) => option.key && String(option.key).trim() !== '')
                            .map((option) => (
                              <SelectItem key={option.key} value={String(option.key)}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="stage" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Stage</Label>
                      <Select
                        value={globalEditFormData.stage || undefined}
                        onValueChange={(value: string) => handleFormFieldChange('stage', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select stage..." />
                        </SelectTrigger>
                        <SelectContent>
                          {withCurrent(stageOptions, globalEditFormData.stage, labelFor(stageOptions, globalEditFormData.stage))
                            .filter((option) => option.key && String(option.key).trim() !== '')
                            .map((option) => (
                              <SelectItem key={option.key} value={String(option.key)}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* <div className="relative">
                      <Label htmlFor="expectedCloseDate" className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Expected Close Date</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500" />
                        <Input
                          id="expectedCloseDate"
                          type="date"
                          value={globalEditFormData.expectedCloseDate ? formatDateForInput(globalEditFormData.expectedCloseDate) : ''}
                          onChange={(e) => handleFormFieldChange('expectedCloseDate', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div> */}
                  </>
                ) : (
                  <>
                    {/* Labelled: the values used to show bare ("success", "Medium"). */}
                    <InfoRow label="Stage" empty="No stage">{labelFor(stageOptions, lead.stage)}</InfoRow>
                    <InfoRow label="Status" empty="Not set">
                      {normalizeDisplayValue(currentStatus, '') && (
                        <span className="inline-flex items-center gap-1.5">
                          {getStatusIcon(currentStatus)}
                          {getStatusLabel(currentStatus, statusOptions as any)}
                        </span>
                      )}
                    </InfoRow>
                    <InfoRow label="Priority" empty="Not set">{labelFor(priorityOptions, lead.priority)}</InfoRow>

                  </>
                )}
              </div>
            </div>
            {/* Meetings: booked meetings, and "Book a meeting" right here (it used
                to be reachable only through Edit Lead). */}
            <div className="col-span-1 md:col-span-2 p-4 bg-gray-50 dark:bg-[#253456] rounded-lg">
              <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary dark:text-blue-300" />
                Meetings
              </h3>
              <div className="flex flex-col gap-4">
                <BookingSlot
                  leadId={lead.id}
                  tenantId={tenantId || undefined}
                  studentId={studentId || undefined}
                  assignedUserId={assignedUserId || undefined}
                  createdBy={createdBy || undefined}
                  users={users}
                  isEditMode={globalEditingOverview || bookingFormOpen}
                  fullWidthButton={true}
                  onRequestBooking={() => setBookingFormOpen(true)}
                />
                {bookingFormOpen && !globalEditingOverview && (
                  <Button type="button" variant="ghost" onClick={() => setBookingFormOpen(false)} className="self-start dark:text-slate-200">
                    Done
                  </Button>
                )}
              </div>
            </div>
            {/* Tags Section */}
            <div className="col-span-1 md:col-span-2 p-4 bg-gray-50 dark:bg-[#253456] rounded-lg">
              <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary dark:text-blue-300" />
                Tags
              </h3>
              {globalEditingOverview ? (
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <Input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(newTagInput);
                          setNewTagInput('');
                        }
                      }}
                      placeholder="Add a tag, then tap +"
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        handleAddTag(newTagInput);
                        setNewTagInput('');
                      }}
                      disabled={!newTagInput.trim()}
                      aria-label="Add tag"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {globalEditFormData.tags && Array.isArray(globalEditFormData.tags) && globalEditFormData.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs overflow-visible max-w-full"
                      >
                        <span className="truncate min-w-0">{formatTag(tag).label}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          aria-label={`Remove tag ${formatTag(tag).label}`}
                          className="relative ml-1 inline-flex size-5 items-center justify-center rounded-full hover:text-red-600 before:absolute before:-inset-3 before:content-['']"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {[...new Map(allTags.map((tag) => [formatTag(tag).label, formatTag(tag)])).values()].map((t) => (
                    <span key={t.label} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${t.className}`}>
                      {t.label}
                    </span>
                  ))}
                  {allTags.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-300 italic">
                      No tags yet
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      label: 'Notes',
      count: notes.length,
      index: 1,
      content: (
        <div className="flex flex-col gap-4">
          {notesLoading ? (
            <div className="flex justify-center py-6">
              <p className="text-sm text-gray-500 dark:text-slate-300">Loading notes...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 dark:bg-[#253456] rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-slate-300">
                    No notes yet. Notes you add when booking a meeting appear here.
                  </p>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-white dark:bg-[#253456] rounded-lg border border-gray-100 dark:border-[#262831] p-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {note.user_name || effectiveTeamMembers.find(m => String(m.id) === String((note as any).created_by ?? note.user_id))?.name || (effectiveTeamMembers.length ? 'Former teammate' : "Name didn't load")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-300">
                          {formatDateTimeUnified(note.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {editingNote.id !== note.id && canUserModify(note.user_id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditNote(note)}
                            aria-label="Edit note"
                            className="h-7 w-7 max-lg:h-11 max-lg:w-11 text-gray-600 dark:text-slate-300 hover:text-blue-500"
                          >
                              <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canUserModify(note.user_id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteConfirmationOpen('note', note.id, note.user_id)}
                            aria-label="Delete note"
                            className="h-7 w-7 max-lg:h-11 max-lg:w-11 text-gray-600 dark:text-slate-300 hover:text-red-500"
                          >
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      {editingNote.id === note.id ? (
                        <div className="space-y-2">
                          <Textarea
                            rows={2}
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveEditNote}
                              disabled={isLoading}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditNote}
                              className="border-gray-300 text-gray-600 dark:text-slate-200 dark:border-[#3a4a6b]"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 dark:text-white">
                          {note.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Comments',
      count: comments.length,
      index: 2,
      content: (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 dark:bg-[#253456] rounded-lg p-4">
            <Label htmlFor="new-comment" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              Add a comment for your team
            </Label>
            <Textarea
              id="new-comment"
              placeholder="Write a comment for your team…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isLoading}
              className="mt-2"
            />
            <div className="flex justify-end mt-3">
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Comment
              </Button>
            </div>
          </div>
          {commentsLoading ? (
            <div className="flex justify-center py-6">
              <p className="text-sm text-gray-500 dark:text-slate-300">Loading comments...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 dark:bg-[#253456] rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-slate-300">
                    No comments yet. Add your first comment above.
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-white dark:bg-[#253456] rounded-lg border border-gray-100 dark:border-[#262831] p-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {comment.user_name || effectiveTeamMembers.find(m => String(m.id) === String((comment as any).created_by ?? comment.user_id))?.name || (effectiveTeamMembers.length ? 'Former teammate' : "Name didn't load")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-300">
                          {formatDateTimeUnified(comment.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {editingComment.id !== comment.id && canUserModify(comment.user_id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditComment(comment)}
                            aria-label="Edit comment"
                            className="h-7 w-7 max-lg:h-11 max-lg:w-11 text-gray-600 dark:text-slate-300 hover:text-blue-500"
                          >
                              <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canUserModify(comment.user_id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteConfirmationOpen('comment', comment.id, comment.user_id)}
                            aria-label="Delete comment"
                            className="h-7 w-7 max-lg:h-11 max-lg:w-11 text-gray-600 dark:text-slate-300 hover:text-red-500"
                          >
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      {editingComment.id === comment.id ? (
                        <div className="space-y-2">
                          <Textarea
                            rows={2}
                            value={editingComment.content}
                            onChange={(e) => setEditingComment({ ...editingComment, content: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveEditComment}
                              disabled={isLoading}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditComment}
                              className="border-gray-300 text-gray-600 dark:text-slate-200 dark:border-[#3a4a6b]"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 dark:text-white">
                          {comment.text || comment.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Files',
      count: attachments.length,
      index: 3,
      content: (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 dark:bg-[#253456] rounded-lg p-4">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full h-24 border-dashed border-2 border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 dark:border-[#3a4a6b] dark:text-slate-300 dark:hover:text-white"
            >
              Tap or click to add a file
            </Button>
          </div>
          {attachmentsLoading ? (
            <div className="flex justify-center py-6">
              <p className="text-sm text-gray-500 dark:text-slate-300">Loading attachments...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attachments.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 dark:bg-[#253456] rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-slate-300">
                    No attachments yet. Upload your first file above.
                  </p>
                </div>
              ) : (
                attachments.map((rawAttachment, index) => {
                  const { filename } = resolveAttachmentNameAndUrl(rawAttachment as any);
                  const attachmentKey = String(
                    (rawAttachment as any)?.id ??
                      (rawAttachment as any)?.db?.id ??
                      (rawAttachment as any)?.file_url ??
                      (rawAttachment as any)?.db?.file_url ??
                      `attachment-${index}`
                  );
                  const attachmentId = (rawAttachment as any)?.id ?? (rawAttachment as any)?.db?.id ?? null;
                  const isDownloading = downloadingAttachmentId !== null && attachmentId === downloadingAttachmentId;
                  return (
                    <div
                      key={attachmentKey}
                      className="max-w-[458px] rounded-lg border border-gray-200 dark:border-[#262831] bg-white dark:bg-[#253456] p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{filename}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          disabled={isLoading || isDownloading}
                          onClick={() => handleDownloadAttachment(rawAttachment)}
                          aria-label={`Download ${filename}`}
                          className="border-gray-300 text-gray-700 dark:text-white dark:border-[#3a4a6b]"
                        >
                          <FileDown className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download'}</span>
                        </Button>
                        {canUserModify((rawAttachment as any)?.user_id) && (
                          <Button
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleDeleteConfirmationOpen('attachment', (rawAttachment as any)?.id ?? (rawAttachment as any)?.db?.id, (rawAttachment as any)?.user_id)}
                            className="border-gray-300 text-gray-700 dark:text-white dark:border-[#3a4a6b]"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )
    }
  ];
  const renderDetailsDialog = () => (
    <Dialog
      open={isDetailsOpen}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
    >

      {/* Phones: 16px inset and a fixed height (it was viewport-64px wide and
          changed height with every tab). Desktop keeps sm:max-w-5xl / 90vh. */}
      <DialogContent className="flex flex-col p-0 overflow-hidden w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] rounded-2xl sm:rounded-3xl sm:h-[90vh] sm:max-h-[90vh] sm:max-w-5xl bg-white dark:bg-[#000724]">
        <DialogHeader className="p-4 pr-14 sm:p-6 sm:pb-4 sm:pr-20 border-b border-gray-200 dark:border-[#262831] sticky top-0 bg-white dark:bg-[#000724] z-10">
          <div className="flex items-center justify-between min-w-0 flex-1">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <Avatar className="h-10 w-10">
                {lead.avatar ? (
                  <img src={lead.avatar} alt={getLeadDisplayName(lead) || 'Lead avatar'} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <span className="text-base font-semibold text-white bg-primary h-full w-full rounded-full flex items-center justify-center">
                    {getAvatarInitial(getLeadDisplayName(lead)) ?? <UserIcon className="h-5 w-5" aria-hidden="true" />}
                  </span>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <DialogTitle className="truncate text-base font-semibold text-gray-900 dark:text-white">{getLeadDisplayName(lead)}</DialogTitle>
                {normalizeDisplayValue((lead.company ?? (lead as any).company_name) as unknown, '') && (
                  <p className="truncate text-sm text-gray-600 dark:text-slate-300">{normalizeDisplayValue((lead.company ?? (lead as any).company_name) as unknown)}</p>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0">
          <div className="w-full">
            <Tabs
              value={String(globalActiveTab)}
              onValueChange={(value) => dispatch(setLeadCardActiveTab(parseInt(value, 10)))}
              className="flex flex-col"
            >
              <div className="border-b border-gray-200 dark:border-[#262831] px-3 sm:px-6 sticky top-0 bg-white dark:bg-[#000724] z-10">
                {/* Four tabs didn't fit at 390px and two were clipped; tighter on
                    phones and scrollable as a fallback. */}
                <TabsList className="flex w-full justify-start sm:justify-around overflow-x-auto no-scrollbar scroll-fade-x bg-gray-50/50 dark:bg-[#1a2a43] p-1 rounded-xl">

                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.index}
                      value={String(tab.index)}
                      className="flex-none sm:flex-1 px-2.5 sm:px-8 text-sm font-medium py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                    >
                      {tab.label}
                      {/* Counts only from sm up: on a 320px phone they pushed Files off-screen. */}
                      {tab.count ? <span className="hidden sm:inline"> ({tab.count})</span> : null}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {tabs.map((tab) => (
                <TabsContent
                  key={tab.index}
                  value={String(tab.index)}
                  className="flex flex-col mt-0 p-4 sm:p-6"
                >
                  {tab.content}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        {globalActiveTab === 0 && (
        <DialogActions className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-4 sm:pb-8 bg-white dark:bg-[#000724]">
          {globalEditingOverview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isLoading}
                  className="rounded-xl h-11 flex-1 sm:flex-none dark:text-slate-200 dark:border-[#3a4a6b]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ignoreNextCardClickRef.current = true;
                    setTimeout(() => {
                      ignoreNextCardClickRef.current = false;
                    }, 0);
                    handleSaveEdit();
                  }}
                  disabled={isLoading}
                  className="rounded-xl px-8 h-11 flex-1 sm:flex-none font-bold bg-[#0B1957] hover:bg-[#0B1957]/90 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-lg transition-all"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStartEdit}
                className="rounded-xl px-8 h-11 flex-1 sm:flex-none font-bold bg-[#0B1957] hover:bg-[#0B1957]/90 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-lg transition-all"
              >
                Edit Lead
              </Button>
            )}
        </DialogActions>
        )}
      </DialogContent>
    </Dialog>
  );
  const renderItemDeleteDialog = () => (
  <Dialog open={deleteConfirmation.open} onOpenChange={(o) => !o && handleDeleteConfirmationClose()}>
    <DialogContent showCloseButton={false} className="p-6 pt-2 sm:max-w-md h-auto max-h-[90vh]">
      <DialogTitle className="flex justify-between items-center">
        <span className="text-lg font-semibold text-[#3A3A4F] dark:text-white">
          Delete {deleteConfirmation.type === 'attachment' ? 'file' : String(deleteConfirmation.type)}
        </span>
        <button
          onClick={handleDeleteConfirmationClose}
          aria-label="Close"
          className="inline-flex items-center justify-center max-lg:size-11 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogTitle>
      <p className="mt-4 text-gray-600 dark:text-slate-300">Are you sure you want to delete this {deleteConfirmation.type === 'attachment' ? 'file' : String(deleteConfirmation.type)}? This can&apos;t be undone.</p>
      <DialogActions>
        <Button type="button" variant="outline" onClick={handleDeleteConfirmationClose} className="rounded-xl h-11 dark:text-slate-200 dark:border-[#3a4a6b]">
          Cancel
        </Button>
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ignoreNextCardClickRef.current = true;
            setTimeout(() => {
              ignoreNextCardClickRef.current = false;
            }, 0);
            handleConfirmDelete();
          }}
          disabled={isLoading}
          className="rounded-xl px-8 h-11 font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all"
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </DialogContent>
  </Dialog>
  );
  // If hideCard is true, only render the dialog
  if (hideCard) {
    // The item-delete confirmation must mount here too, or Delete on a note,
    // comment or file in the list view silently did nothing.
    return <>{renderDetailsDialog()}{renderItemDeleteDialog()}</>;
  }
  const assignedPreview = assignedUsers.slice(0, isMobile ? 2 : 3);
  const remainingAssignees = Math.max(assignedUsers.length - assignedPreview.length, 0);
  const showDetails = globalExpanded || !isMobile;
  const trendValue = getActivityTrend();
  const progressValue = getProgressValue();
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      // CRITICAL: Do NOT spread {...listeners} here - it blocks ALL click events
      role="presentation"
    >
      <div
        className={`relative rounded-2xl border border-gray-100 dark:border-[#262831] bg-white dark:bg-[#1a2a43] p-4 shadow-sm transition ${
          isDragging ? 'opacity-50 cursor-grabbing' : 'hover:shadow-md'
        }`}
        // Enable pointer events on card for clicks
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
        onClick={handleCardClick}
        onKeyDown={handleKeyPress}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-start gap-3 group">
          {/* CRITICAL: Apply drag listeners ONLY to drag handle */}
          <button
            type="button"
            data-ignore-card-click
            className="drag-handle text-gray-400 dark:text-slate-300 hover:text-gray-600 dark:hover:text-white mt-1 cursor-grab active:cursor-grabbing"
            {...listeners}
            onMouseDown={handleDragHandleMouseDown}
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start gap-2">
              <p
                ref={leadNameRef}
                onMouseEnter={() => {
                  const el = leadNameRef.current;
                  if (!el) return;
                  const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
                  animateHorizontalScrollInfinite(el, maxScroll);
                }}
                onMouseLeave={() => {
                  const el = leadNameRef.current;
                  if (!el) return;
                  stopHorizontalScroll(el);
                }}
                className="text-sm font-semibold text-gray-900 dark:text-white flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis group-hover:overflow-x-auto group-hover:text-clip [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-thumb]:bg-transparent"
              >
                {getLeadDisplayName(lead)}
              </p>
            </div>
            {activityData.length > 0 && (
              <span
                className={`text-xs flex items-center gap-1 ${trendValue > 0 ? 'text-green-500' : 'text-red-500'}`}
                title="Activity trend"
              >
                {trendValue > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" data-ignore-card-click className="focus:outline-none">
                {(() => {
                  const status = String(currentStatus || '').toLowerCase();
                  const isSuccess = ['won', 'closed', 'success', 'converted', 'active'].includes(status);
                  const isFailed = ['lost', 'failed', 'rejected', 'inactive', 'cancelled'].includes(status);
                  const isNew = ['new'].includes(status);

                  let badgeClass = 'text-xs flex items-center gap-1 capitalize bg-primary/10 text-primary';
                  if (isSuccess) {
                    badgeClass = 'text-xs flex items-center gap-1 capitalize bg-green-100 text-green-600';
                  } else if (isFailed) {
                    badgeClass = 'text-xs flex items-center gap-1 capitalize bg-red-100 text-red-600';
                  } else if (isNew) {
                    badgeClass = 'text-xs flex items-center gap-1 capitalize bg-violet-100 text-violet-600';
                  }

                  return (
                    <Badge className={badgeClass}>
                      {getStatusIcon(currentStatus)}
                      {getStatusLabel(currentStatus, statusOptions)}
                    </Badge>
                  );
                })()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {statusOptions.map((statusOption) => (
                <DropdownMenuItem
                  key={statusOption.key}
                  onSelect={() => handleStatusChange(statusOption.key)}
                  className="flex items-center gap-2"
                >
                  {getStatusIcon(statusOption.key)}
                  <span>{statusOption.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-ignore-card-click
                className="text-gray-400 dark:text-slate-300 hover:text-gray-600 dark:hover:text-white focus:outline-none p-1 rounded hover:bg-gray-100 dark:hover:bg-[#253456]"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onSelect={(event) => {
                  event.preventDefault();
                  ignoreNextCardClickRef.current = true;
                  setTimeout(() => {
                    ignoreNextCardClickRef.current = false;
                  }, 0);
                  setDeleteDialogOpen(true);
                }}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Lead</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {assignedPreview.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex -space-x-2">
              {assignedPreview.map((user) => (
                <Avatar
                  key={user.id || user.name}
                  className="h-6 w-6 border-2 border-white bg-blue-100 text-blue-700 text-xs"
                >
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
              ))}
              {remainingAssignees > 0 && (
                <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-[#253456] text-xs flex items-center justify-center border-2 border-white dark:border-[#1a2a43]">
                  +{remainingAssignees}
                </div>
              )}
            </div>
          </div>
        )}
        {showDetails && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap justify-between gap-3 text-sm text-gray-700">
              {/* <span className="flex items-center gap-1 font-semibold text-green-600">
                <DollarSign className="h-4 w-4" />
                {formatCurrency((lead.amount as number) || 0)}
              </span> */}
              {(lead.closeDate as string | undefined) && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    (() => { const days = getDaysRemaining(); return days !== null && days < 7 ? 'text-red-500' : 'text-gray-500'; })()
                  }`}
                  title={(() => { const days = getDaysRemaining(); return days !== null ? `Due in ${days} days` : undefined; })()}
                >
                  <Calendar className="h-4 w-4" />
                  {formatDateTimeUnified((lead.closeDate as string) || undefined)}
                </span>
              )}
            </div>

            {(lead.description as string | undefined) && (
              <p className="text-sm text-gray-600 dark:text-slate-300">{String(lead.description as unknown)}</p>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-gray-100 dark:border-[#262831] pt-2 text-xs text-gray-500 dark:text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTimeUnified(getFieldValueLocal(lead, 'updatedAt'))}
          </span>
          <div className="flex items-center gap-3">
            {notes.length > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {notes.length}
              </span>
            )}
            {comments.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {comments.length}
              </span>
            )}
            {attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {attachments.length}
              </span>
            )}
             {normalizeDisplayValue(
                getOptionLabel(sourceOptions, String((lead as any)?.source || undefined)) || (lead as any)?.source,
                ''
              ) && (
                <PipelineBadge
                  source={normalizeDisplayValue(
                    getOptionLabel(sourceOptions, String((lead as any)?.source || undefined)) || (lead as any)?.source
                  )}
                  showLabel={false}
                />
              )}
            {/* Separator line between source and temperature badges */}
            {(() => {
              // Check for temperature in tags or priority
              const tags = Array.isArray(lead.tags) ? lead.tags : [];
              const priority = String(lead.priority || '').toLowerCase();
              const allTags = tags.map((t: string) => t.toLowerCase());

              let temperature: string | null = null;
              // Check for hot/warm/cold in tags (handles "Cold Lead", "Hot Prospect", etc.)
              const hasHot = allTags.some((t: string) => t.includes('hot'));
              const hasWarm = allTags.some((t: string) => t.includes('warm'));
              const hasCold = allTags.some((t: string) => t.includes('cold'));

              if (hasHot || priority === 'hot') temperature = 'Hot';
              else if (hasWarm || priority === 'warm') temperature = 'Warm';
              else if (hasCold || priority === 'cold') temperature = 'Cold';

              return temperature ? (
                <>
                  <div className="w-px h-4 bg-gray-200 dark:bg-[#262831]" />
                  <PipelineBadge
                    source={temperature}
                    showLabel={false}
                  />
                </>
              ) : null;
            })()}
          </div>
        </div>
      </div>
      {renderDetailsDialog()}
      <Dialog open={deleteDialogOpen}>
        <DialogContent className="p-0 overflow-hidden flex flex-col justify-between">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-50 text-red-600 border border-red-100 shadow-sm">
                <Trash2 className="h-5 w-5 stroke-[2.5px]" />
              </div>
              <DialogTitle>Delete Lead</DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-8">
            <p className="text-gray-600 dark:text-slate-300 text-base">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{getLeadDisplayName(lead)}</span>?
              This action is permanent and cannot be undone.
            </p>
          </div>
          <DialogActions>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                ignoreNextCardClickRef.current = true;
                setTimeout(() => {
                  ignoreNextCardClickRef.current = false;
                }, 0);
                handleConfirmDelete();
              }}
              disabled={isLoading}
              className="px-8 bg-red-600 hover:bg-red-700 text-white h-11 rounded-xl font-bold shadow-lg transition-all"
            >
              {isLoading ? 'Deleting...' : 'Delete Lead'}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      {renderItemDeleteDialog()}
      {snackbar.open && (
        <div
          className={`fixed bottom-4 right-4 rounded-lg px-4 py-2 text-sm text-white shadow-lg ${snackbarClasses[snackbar.severity]}`}
        >
          {snackbar.message}
        </div>
      )}
    </div>
  );
};
export default React.memo(PipelineLeadCard, (prevProps, nextProps) => {
  // Comprehensive comparison to prevent unnecessary re-renders
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.status === nextProps.lead.status &&
    prevProps.lead.priority === nextProps.lead.priority &&
    prevProps.lead.stage === nextProps.lead.stage &&
    prevProps.lead.name === nextProps.lead.name &&
    prevProps.lead.amount === nextProps.lead.amount &&
    prevProps.lead.company === nextProps.lead.company &&
    prevProps.lead.email === nextProps.lead.email &&
    prevProps.lead.phone === nextProps.lead.phone &&
    JSON.stringify(prevProps.lead.tags) === JSON.stringify(nextProps.lead.tags) &&
    JSON.stringify(prevProps.lead.goals) === JSON.stringify(nextProps.lead.goals) &&
    prevProps.lead.assignee === nextProps.lead.assignee &&
    (prevProps.lead as any).assigned_to_id === (nextProps.lead as any).assigned_to_id &&
    (prevProps.lead as any).title === (nextProps.lead as any).title &&
    prevProps.lead.avatar === nextProps.lead.avatar &&
    (prevProps.lead as any).source === (nextProps.lead as any).source &&
    prevProps.hideCard === nextProps.hideCard &&
    prevProps.isPreview === nextProps.isPreview &&
    prevProps.externalDetailsOpen === nextProps.externalDetailsOpen
    // Note: activeCardId intentionally excluded - handled by parent's activeCard state
  );
}); 
