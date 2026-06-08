'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import {
  X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthenticatedMediaImage } from './AuthenticatedMediaImage';
import type { MediaViewerItem } from './media-utils';

interface WhatsAppMediaViewerProps {
  items: MediaViewerItem[];
  initialIndex: number;
  contactName?: string;
  contactAvatar?: string;
  onClose: () => void;
}

function formatViewerTimestamp(date: Date): string {
  const time = format(date, 'h:mm a');
  if (isToday(date)) return `Today at ${time}`;
  if (isYesterday(date)) return `Yesterday at ${time}`;
  return format(date, `d MMM yyyy 'at' h:mm a`);
}

export function WhatsAppMediaViewer({
  items,
  initialIndex,
  contactName,
  contactAvatar,
  onClose,
}: WhatsAppMediaViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  const current = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setIndex((i) => i - 1);
      setZoom(1);
    }
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) {
      setIndex((i) => i + 1);
      setZoom(1);
    }
  }, [hasNext]);

  useEffect(() => {
    setIndex(initialIndex);
    setZoom(1);
  }, [initialIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!current) return null;

  const displayName = current.isOutgoing ? 'You' : (contactName || current.senderName);

  const handleDownload = async () => {
    try {
      const res = await fetch(current.url, { credentials: 'include' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `media-${current.id}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(current.url, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[#0b141a]/98 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-[#202c33]/90">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-[#aebac1] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-[#6b7c85] flex items-center justify-center overflow-hidden shrink-0">
            {contactAvatar && !current.isOutgoing ? (
              <img src={contactAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[#e9edef] truncate">{displayName}</p>
            <p className="text-[12px] text-[#8696a0]">{formatViewerTimestamp(current.timestamp)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-2 rounded-full hover:bg-white/10 text-[#aebac1]"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-2 rounded-full hover:bg-white/10 text-[#aebac1]"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-full hover:bg-white/10 text-[#aebac1]"
            aria-label="Download"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex items-center justify-center min-h-0 px-14">
        {hasPrev && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 z-10 p-2 rounded-full bg-[#202c33]/80 hover:bg-[#202c33] text-[#aebac1] transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}

        <div className="flex items-center justify-center w-full h-full overflow-auto">
          {current.type === 'video' ? (
            <video
              src={current.url}
              controls
              className="max-w-full max-h-full rounded-md"
              style={{ transform: `scale(${zoom})` }}
            />
          ) : (
            <div style={{ transform: `scale(${zoom})` }} className="transition-transform duration-200">
              <AuthenticatedMediaImage
                src={current.url.startsWith('data:') ? current.url : undefined}
                mediaId={current.mediaId}
                fileBase64={current.fileBase64}
                contentType={current.contentType}
                alt={current.caption || 'Photo'}
                className="max-w-full max-h-[calc(100vh-200px)] object-contain select-none"
              />
            </div>
          )}
        </div>

        {hasNext && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 z-10 p-2 rounded-full bg-[#202c33]/80 hover:bg-[#202c33] text-[#aebac1] transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}
      </div>

      {/* Caption + thumbnails */}
      <div className="shrink-0 bg-[#202c33]/90">
        {current.caption && (
          <p className="text-center text-[14px] text-[#e9edef] px-6 py-3 leading-snug">
            {current.caption}
          </p>
        )}

        {items.length > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 pb-4 overflow-x-auto">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setIndex(i); setZoom(1); }}
                className={cn(
                  'shrink-0 w-14 h-14 rounded overflow-hidden border-2 transition-all',
                  i === index
                    ? 'border-[#00a884] opacity-100'
                    : 'border-transparent opacity-50 hover:opacity-80',
                )}
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full bg-[#111b21] flex items-center justify-center text-[10px] text-[#8696a0]">
                    Video
                  </div>
                ) : (
                  <AuthenticatedMediaImage
                    src={item.url.startsWith('data:') ? item.url : undefined}
                    mediaId={item.mediaId}
                    fileBase64={item.fileBase64}
                    contentType={item.contentType}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
