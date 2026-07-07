'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/app-toaster';
import {
  useCreateLinkedInMessageTemplate,
  useUpdateLinkedInMessageTemplate,
  uploadLinkedInTemplateMedia,
  LINKEDIN_CONNECTION_MESSAGE_MAX_LENGTH,
} from '@lad/frontend-features/campaigns';
import type {
  LinkedInMessageTemplate,
  CreateLinkedInTemplateRequest,
  LinkedInTemplateMediaType,
} from '@lad/frontend-features/campaigns';
import { Loader2, Save, AlertCircle, Linkedin, Paperclip, X, FileText, Film, Music } from 'lucide-react';

const MEDIA_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface CreateLinkedInTemplateModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal edits this template instead of creating a new one */
  editing?: LinkedInMessageTemplate | null;
}

const CATEGORIES = ['sales', 'recruiting', 'networking', 'partnership', 'custom'] as const;

export default function CreateLinkedInTemplateModal({
  open,
  onClose,
  editing,
}: CreateLinkedInTemplateModalProps) {
  const { push } = useToast();
  const createMutation = useCreateLinkedInMessageTemplate();
  const updateMutation = useUpdateLinkedInMessageTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [followupMessage, setFollowupMessage] = useState('');
  const [category, setCategory] = useState<string>('sales');
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Media attachment (image / video / audio-voice-note / document).
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<LinkedInTemplateMediaType | string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate form when opening (create = blank, edit = existing values)
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setConnectionMessage(editing?.connection_message ?? '');
    setFollowupMessage(editing?.followup_message ?? '');
    setCategory(editing?.category ?? 'sales');
    setIsDefault(editing?.is_default ?? false);
    const meta = (editing?.metadata ?? {}) as Record<string, any>;
    setMediaUrl(meta.media_url ?? null);
    setMediaType(meta.media_type ?? null);
    setMediaFilename(meta.media_filename ?? null);
    setErrors({});
  }, [open, editing]);

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file next time.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setUploadingMedia(true);
    try {
      const result = await uploadLinkedInTemplateMedia(file);
      setMediaUrl(result.url);
      setMediaType(result.media_type);
      setMediaFilename(result.filename);
      setErrors((prev) => { const { media, ...rest } = prev; return rest; });
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, media: err?.message || 'Upload failed. Please try again.' }));
      push({ variant: 'error', title: 'Upload Failed', description: err?.message || 'Could not upload the file.' });
    } finally {
      setUploadingMedia(false);
    }
  };

  const clearMedia = () => {
    setMediaUrl(null);
    setMediaType(null);
    setMediaFilename(null);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Template name is required';
    if (!connectionMessage.trim() && !followupMessage.trim()) {
      e.messages = 'Provide at least a connection or a follow-up message';
    }
    if (connectionMessage.length > LINKEDIN_CONNECTION_MESSAGE_MAX_LENGTH) {
      e.connection = `Connection message must be ${LINKEDIN_CONNECTION_MESSAGE_MAX_LENGTH} characters or less`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: CreateLinkedInTemplateRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      connection_message: connectionMessage.trim() || undefined,
      followup_message: followupMessage.trim() || undefined,
      category,
      is_default: isDefault,
      is_active: true,
      // Media (flat fields — backend folds them into metadata). On edit, an
      // explicit null clears a previously-attached file.
      media_url: mediaUrl ?? (editing ? null : undefined),
      media_type: mediaUrl ? mediaType : null,
      media_filename: mediaUrl ? mediaFilename : null,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload });
        push({ variant: 'success', title: 'Template Updated', description: `"${name}" has been updated.` });
      } else {
        await createMutation.mutateAsync(payload);
        push({ variant: 'success', title: 'Template Saved', description: `"${name}" has been created.` });
      }
      onClose();
    } catch (err: any) {
      push({
        variant: 'error',
        title: editing ? 'Update Failed' : 'Save Failed',
        description: err?.message || 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/20 flex items-center justify-center w-10 h-10">
              <Linkedin className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <DialogTitle>{editing ? 'Edit LinkedIn Template' : 'New LinkedIn Template'}</DialogTitle>
              <DialogDescription>
                Reusable connection request &amp; follow-up messages for LinkedIn outreach
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-8 py-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="li-name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="li-name"
              placeholder="e.g. Sales Outreach - Enterprise"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="li-desc">Description (optional)</Label>
            <Input
              id="li-desc"
              placeholder="When to use this template…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Connection message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="li-conn">Connection Message</Label>
              <span className={`text-xs ${connectionMessage.length > LINKEDIN_CONNECTION_MESSAGE_MAX_LENGTH ? 'text-red-600' : 'text-muted-foreground'}`}>
                {connectionMessage.length}/{LINKEDIN_CONNECTION_MESSAGE_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="li-conn"
              placeholder="Hi {{first_name}}, I came across your work at {{company}} and would love to connect."
              value={connectionMessage}
              onChange={(e) => setConnectionMessage(e.target.value)}
              rows={3}
              className={`resize-none text-sm ${errors.connection ? 'border-red-500' : ''}`}
            />
            {errors.connection && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.connection}
              </p>
            )}
          </div>

          {/* Follow-up message */}
          <div className="space-y-1.5">
            <Label htmlFor="li-followup">Follow-up Message</Label>
            <Textarea
              id="li-followup"
              placeholder="Thanks for connecting, {{first_name}}! I wanted to share…"
              value={followupMessage}
              onChange={(e) => setFollowupMessage(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Use <code className="px-1 py-0.5 rounded bg-muted">{'{{first_name}}'}</code>,{' '}
            <code className="px-1 py-0.5 rounded bg-muted">{'{{company}}'}</code>,{' '}
            <code className="px-1 py-0.5 rounded bg-muted">{'{{title}}'}</code> for personalization.
          </p>

          {/* Media attachment (image / video / voice note / document) */}
          <div className="space-y-1.5">
            <Label>Attachment (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={MEDIA_ACCEPT}
              onChange={handleMediaSelect}
              className="hidden"
            />
            {mediaUrl ? (
              <div className="flex items-center gap-3 p-2 border rounded-md">
                {mediaType === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt={mediaFilename || 'attachment'} className="h-14 w-14 rounded object-cover border" />
                ) : (
                  <div className="h-14 w-14 rounded bg-muted flex items-center justify-center text-muted-foreground">
                    {mediaType === 'video' ? <Film className="h-6 w-6" />
                      : mediaType === 'audio' ? <Music className="h-6 w-6" />
                      : <FileText className="h-6 w-6" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{mediaFilename || 'Attachment'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{mediaType || 'file'}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearMedia} title="Remove attachment">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="w-full justify-start text-muted-foreground"
              >
                {uploadingMedia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                {uploadingMedia ? 'Uploading…' : 'Attach image, video, voice note, or document'}
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              Sent alongside the connection request / follow-up. Max 25MB.
            </p>
            {errors.media && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.media}
              </p>
            )}
          </div>

          {errors.messages && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {errors.messages}
            </p>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="li-cat">Category</Label>
            <select
              id="li-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-9 px-3 py-2 text-sm border border-input rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>

          {/* Default toggle */}
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="space-y-0.5">
              <Label htmlFor="li-default" className="text-sm font-medium">Set as Default Template</Label>
              <p className="text-xs text-muted-foreground">Used automatically for new campaigns</p>
            </div>
            <Switch id="li-default" checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || uploadingMedia}
            className="px-8 bg-[#0B1957] hover:bg-[#0B1957]/90 text-white rounded-xl"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {editing ? 'Save Changes' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
