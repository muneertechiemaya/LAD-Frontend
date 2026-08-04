'use client';

import React, { useState, useEffect } from 'react';
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
  useCreateInstagramMessageTemplate,
  useUpdateInstagramMessageTemplate,
  INSTAGRAM_DM_RECOMMENDED_MAX_LENGTH,
} from '@lad/frontend-features/campaigns';
import type {
  InstagramMessageTemplate,
  CreateInstagramTemplateRequest,
} from '@lad/frontend-features/campaigns';
import { Loader2, Save, AlertCircle, Instagram } from 'lucide-react';

interface CreateInstagramTemplateModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal edits this template instead of creating a new one */
  editing?: InstagramMessageTemplate | null;
}

export default function CreateInstagramTemplateModal({
  open,
  onClose,
  editing,
}: CreateInstagramTemplateModalProps) {
  const { push } = useToast();
  const createMutation = useCreateInstagramMessageTemplate();
  const updateMutation = useUpdateInstagramMessageTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setContent(editing?.content ?? '');
    setMediaUrl((editing?.metadata?.media_url as string) ?? '');
    setIsDefault(editing?.is_default ?? false);
    setErrors({});
  }, [open, editing]);

  const saving = createMutation.isPending || updateMutation.isPending;
  const overLimit = content.length > INSTAGRAM_DM_RECOMMENDED_MAX_LENGTH;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Template name is required';
    if (!content.trim()) e.content = 'Message body is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: CreateInstagramTemplateRequest = {
      name: name.trim(),
      content: content.trim(),
      description: description.trim() || undefined,
      media_url: mediaUrl.trim() || undefined,
      is_default: isDefault,
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
            <div className="p-2.5 rounded-full bg-gradient-to-br from-[#F58529]/15 via-[#DD2A7B]/15 to-[#8134AF]/15 text-[#DD2A7B] border border-[#DD2A7B]/20 flex items-center justify-center w-10 h-10">
              <Instagram className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <DialogTitle>{editing ? 'Edit Instagram Template' : 'New Instagram Template'}</DialogTitle>
              <DialogDescription>
                Reusable Instagram DM — no Meta approval required
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-8 py-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ig-name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ig-name"
              placeholder="e.g. Welcome DM"
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

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ig-content">
                Message Body <span className="text-red-500">*</span>
              </Label>
              <span className={`text-xs ${overLimit ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {content.length}{overLimit ? ` · long DMs convert poorly` : ''}
              </span>
            </div>
            <Textarea
              id="ig-content"
              placeholder={'Hey {{first_name}}! 👋 Saw you follow {{company}} — wanted to reach out…'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className={`resize-none text-sm ${errors.content ? 'border-red-500' : ''}`}
            />
            {errors.content && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.content}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Use <code className="px-1 py-0.5 rounded bg-muted">{'{{first_name}}'}</code>,{' '}
              <code className="px-1 py-0.5 rounded bg-muted">{'{{username}}'}</code>,{' '}
              <code className="px-1 py-0.5 rounded bg-muted">{'{{company}}'}</code> for personalization.
            </p>
          </div>

          {/* Media URL (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ig-media">Media URL (optional)</Label>
            <Input
              id="ig-media"
              placeholder="https://… image or video to attach"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ig-desc">Description (optional)</Label>
            <Input
              id="ig-desc"
              placeholder="Internal note about this template"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Default toggle */}
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="space-y-0.5">
              <Label htmlFor="ig-default" className="text-sm font-medium">Set as Default Template</Label>
              <p className="text-xs text-muted-foreground">Used automatically for new campaigns</p>
            </div>
            <Switch id="ig-default" checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
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
