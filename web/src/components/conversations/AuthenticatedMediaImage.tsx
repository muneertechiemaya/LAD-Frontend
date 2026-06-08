'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildMediaProxyUrl, buildResolveMediaUrl, isMetaMediaHandle } from './media-utils';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;

  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    if (rawName?.trim() === 'token') {
      headers.Authorization = `Bearer ${decodeURIComponent(rawValueParts.join('=') || '')}`;
      break;
    }
  }
  if (!headers.Authorization) {
    const stored = localStorage.getItem('token');
    if (stored) headers.Authorization = `Bearer ${stored}`;
  }

  const selected = localStorage.getItem('selectedTenantId');
  const tenantId = selected && selected !== 'default' ? selected : (() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        return user?.tenantId || user?.organizationId || null;
      }
    } catch { /* ignore */ }
    return null;
  })();
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  return headers;
}

async function fetchAsBlobUrl(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function resolveToBlobUrl(
  mediaId: string,
  fileBase64: string | undefined,
  contentType: string | undefined,
  channel: 'waba' | 'personal',
): Promise<string> {
  if (fileBase64) {
    return `data:${contentType || 'application/octet-stream'};base64,${fileBase64}`;
  }
  if (!mediaId) throw new Error('No media reference');
  if (mediaId.startsWith('http')) return fetchAsBlobUrl(mediaId);

  if (isMetaMediaHandle(mediaId)) {
    const resolveUrl = buildResolveMediaUrl(mediaId, channel);
    const res = await fetch(resolveUrl, { headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error(`Resolve failed ${res.status}`);
    const data = await res.json();
    if (!data?.url) throw new Error('No URL from resolve-media');
    return fetchAsBlobUrl(data.url);
  }

  return fetchAsBlobUrl(buildMediaProxyUrl(mediaId, channel));
}

interface AuthenticatedMediaImageProps {
  /** Pre-built fetch URL (proxy, resolve, or data:) */
  src?: string;
  /** Raw media reference — used when src is empty */
  mediaId?: string;
  fileBase64?: string;
  contentType?: string;
  channel?: 'waba' | 'personal';
  alt?: string;
  className?: string;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Renders WhatsApp media with auth headers.
 * Supports data URLs, proxy URLs, Meta handles (via resolve-media), and direct http URLs.
 */
export function AuthenticatedMediaImage({
  src,
  mediaId = '',
  fileBase64,
  contentType,
  channel = 'waba',
  alt = 'Photo',
  className,
  onClick,
  onLoad,
  onError,
}: AuthenticatedMediaImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(
    src?.startsWith('data:') ? src : null,
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setFailed(false);

      try {
        let result: string;

        if (src?.startsWith('data:')) {
          result = src;
        } else if (fileBase64) {
          result = `data:${contentType || 'image/jpeg'};base64,${fileBase64}`;
        } else if (src && !src.includes('resolve-media')) {
          result = await fetchAsBlobUrl(src);
          objectUrl = result.startsWith('blob:') ? result : null;
        } else if (mediaId || src) {
          result = await resolveToBlobUrl(mediaId || '', fileBase64, contentType, channel);
          if (result.startsWith('blob:')) objectUrl = result;
        } else {
          throw new Error('No media source');
        }

        if (!cancelled) {
          setResolvedSrc(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
          onError?.();
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, mediaId, fileBase64, contentType, channel, onError]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center bg-[#e9edef] dark:bg-[#1a2b33] min-h-[160px]', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (failed || !resolvedSrc) {
    return (
      <div className={cn('flex items-center justify-center bg-[#e9edef] dark:bg-[#1a2b33] min-h-[100px] rounded', className)}>
        <div className="flex flex-col items-center gap-1 opacity-40">
          <ImageIcon className="w-8 h-8" />
          <span className="text-[11px]">Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onLoad={onLoad}
      onError={() => { setFailed(true); onError?.(); }}
      loading="lazy"
      draggable={false}
    />
  );
}
