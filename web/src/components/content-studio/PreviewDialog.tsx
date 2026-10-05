'use client';
import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { ContentPost, Platform } from '@lad/frontend-features/content-studio';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { PLATFORM_META, formatName, postTitle } from '@/lib/content-studio/meta';
import { DownloadMenu } from './DownloadMenu';
import { PlatformPreview } from './PlatformPreview';
import { CsButton, tone } from './ui';

/** Read-only look at a post the way its platform shows it. 1 tap from a card. */
export function PreviewDialog({
  post,
  onClose,
  onEdit,
}: {
  post: ContentPost | null;
  onClose: () => void;
  onEdit: (p: ContentPost) => void;
}) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const shown = platform || post?.platform || 'linkedin';
  return (
    <Dialog
      open={!!post}
      onOpenChange={(o) => {
        if (!o) {
          setPlatform(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {post ? (
          <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
            <DialogTitle className="pr-10 text-xl">{postTitle(post)}</DialogTitle>
            <DialogDescription className={tone.soft}>
              {PLATFORM_META[post.platform].label} · {formatName(post.platform, post.format)}
              {post.pillar ? ` · ${post.pillar}` : ''}
            </DialogDescription>
            <PlatformPreview post={post} platform={shown} />
            <div className="flex flex-wrap justify-end gap-2">
              <DownloadMenu post={post} />
              <CsButton variant="primary" size="sm" onClick={() => onEdit(post)}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </CsButton>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
