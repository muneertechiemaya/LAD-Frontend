import type { Message } from '@/types/conversation';

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

export type MediaViewerItem = {
  id: string;
  url: string;
  type: 'image' | 'video';
  caption?: string;
  senderName: string;
  timestamp: Date;
  isOutgoing: boolean;
  mediaId?: string;
  fileBase64?: string;
  contentType?: string;
};

type MessageWithMedia = Message & {
  type?: string;
  fileBase64?: string;
  contentType?: string;
};

/** Meta upload handles contain ":" and are not plain numeric IDs */
export function isMetaMediaHandle(id: string): boolean {
  return id.includes(':') && !id.startsWith('http') && !id.startsWith('pwa_') && !id.startsWith('data:');
}

/** Extract media reference from any field the WABA backend may use */
export function extractMediaId(raw: Record<string, unknown>, metadata: Record<string, unknown>): string | undefined {
  const mediaObj = metadata.media as Record<string, unknown> | undefined;
  const attachment = Array.isArray(raw.attachments) ? raw.attachments[0] as Record<string, unknown> : undefined;

  const candidates = [
    metadata.media_id,
    metadata.mediaId,
    metadata.whatsapp_media_id,
    metadata.header_media_id,
    metadata.header_url,
    metadata.media_handle,
    metadata.handle,
    metadata.file_url,
    metadata.url,
    metadata.image_url,
    metadata.media_url,
    metadata.storage_url,
    metadata.gcs_url,
    mediaObj?.id,
    mediaObj?.media_id,
    mediaObj?.url,
    raw.media_id,
    raw.mediaId,
    raw.file_url,
    raw.url,
    raw.media_url,
    raw.image_url,
    raw.storage_url,
    attachment?.url,
    attachment?.media_id,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number') return String(c);
  }
  return undefined;
}

export function isMediaMessage(message: Message): boolean {
  const raw = message as MessageWithMedia;
  if (message.mediaId || raw.fileBase64) return true;
  const mt = (message.mediaType || raw.type || '').toLowerCase();
  if (MEDIA_TYPES.has(mt)) return true;
  // Infer from filename-shaped content
  const content = message.content?.trim() || '';
  if (/\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(content)) return true;
  return false;
}

export function resolveMediaCaption(message: Message): string | undefined {
  if (message.mediaCaption) return message.mediaCaption;
  const content = message.content?.trim();
  if (!content) return undefined;
  if (message.mediaFilename && content === message.mediaFilename) return undefined;
  if (/\.(png|jpe?g|gif|webp|bmp|heic|mp4|mov|avi|pdf|docx?|xlsx?|pptx?|mp3|wav|ogg|webm)$/i.test(content)) {
    return undefined;
  }
  return content;
}

export function buildMediaProxyUrl(mediaId: string, channel: 'waba' | 'personal' = 'waba'): string {
  return `/api/whatsapp-conversations/conversations/media/${encodeURIComponent(mediaId)}?channel=${channel}`;
}

export function buildResolveMediaUrl(handle: string, channel: 'waba' | 'personal' = 'waba'): string {
  return `/api/whatsapp-conversations/conversations/templates/resolve-media?handle=${encodeURIComponent(handle)}&channel=${channel}`;
}

export function buildMediaUrl(
  mediaId: string,
  fileBase64?: string,
  contentType?: string,
  channel: 'waba' | 'personal' = 'waba',
): string {
  if (fileBase64) {
    return `data:${contentType || 'application/octet-stream'};base64,${fileBase64}`;
  }
  if (!mediaId) return '';
  if (mediaId.startsWith('http')) return mediaId;
  if (isMetaMediaHandle(mediaId)) return buildResolveMediaUrl(mediaId, channel);
  return buildMediaProxyUrl(mediaId, channel);
}

export function getMessageMediaType(message: Message): string {
  const raw = message as MessageWithMedia;
  const fromField = message.mediaType || raw.type || '';
  if (fromField) return fromField;
  const content = message.content?.trim() || '';
  if (/\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(content)) return 'image';
  if (/\.(mp4|mov|avi|webm)$/i.test(content)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)$/i.test(content)) return 'audio';
  if (/\.(pdf|docx?|xlsx?|pptx?)$/i.test(content)) return 'document';
  return 'document';
}

export function getMessageMediaUrl(message: Message, channel: 'waba' | 'personal' = 'waba'): string {
  const raw = message as MessageWithMedia;
  return buildMediaUrl(message.mediaId || '', raw.fileBase64, raw.contentType, channel);
}

export function isImageMessage(message: Message): boolean {
  const mt = getMessageMediaType(message).toLowerCase();
  const mime = message.mediaMimeType || (message as MessageWithMedia).contentType || '';
  return mt === 'image' || mt === 'sticker' || mime.startsWith('image/');
}

export function isVideoMessage(message: Message): boolean {
  const mt = getMessageMediaType(message).toLowerCase();
  const mime = message.mediaMimeType || (message as MessageWithMedia).contentType || '';
  return mt === 'video' || mime.startsWith('video/');
}

export function buildMediaGallery(messages: Message[], channel: 'waba' | 'personal' = 'waba'): MediaViewerItem[] {
  return messages
    .filter((m) => isImageMessage(m) || isVideoMessage(m))
    .map((m) => {
      const raw = m as MessageWithMedia;
      const url = getMessageMediaUrl(m, channel);
      // Include the item if we have ANY source: url, fileBase64, or mediaId.
      // This ensures optimistic sent images (fileBase64 only) appear in the viewer.
      const hasPreview = Boolean(url || raw.fileBase64 || m.mediaId);
      if (!hasPreview) return null;
      // Build the viewer URL — prefer data URI from base64 if the constructed url is empty
      const viewerUrl =
        url ||
        (raw.fileBase64
          ? `data:${raw.contentType || 'image/jpeg'};base64,${raw.fileBase64}`
          : '');
      if (!viewerUrl) return null;
      return {
        id: m.id,
        url: viewerUrl,
        type: isVideoMessage(m) ? 'video' : 'image',
        caption: resolveMediaCaption(m),
        senderName: m.isOutgoing ? (m.senderName || m.sender?.name || 'You') : (m.sender?.name || 'Contact'),
        timestamp: new Date(m.timestamp),
        isOutgoing: m.isOutgoing,
        mediaId: m.mediaId,
        fileBase64: raw.fileBase64,
        contentType: raw.contentType,
      } satisfies MediaViewerItem;
    })
    .filter((item): item is MediaViewerItem => item !== null);
}
