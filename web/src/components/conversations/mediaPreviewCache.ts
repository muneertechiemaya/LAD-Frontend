/**
 * Session cache for locally-sent media previews.
 * When the backend stores only the filename (no media_id), we keep the
 * original base64 so images still render in the chat until a page reload.
 */
import type { Message } from '@/types/conversation';

const STORAGE_KEY = 'wa_media_previews_v1';
const MAX_ENTRIES = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedMediaPreview {
  base64: string;
  contentType: string;
  filename?: string;
  ts: number;
}

type Store = Record<string, CachedMediaPreview>;

function loadStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  if (typeof window === 'undefined') return;
  const entries = Object.entries(store)
    .filter(([, v]) => Date.now() - v.ts < MAX_AGE_MS)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function setCachedMediaPreview(
  messageId: string,
  preview: Omit<CachedMediaPreview, 'ts'>,
): void {
  const store = loadStore();
  store[messageId] = { ...preview, ts: Date.now() };
  if (preview.filename) {
    store[`fn:${preview.filename}`] = { ...preview, ts: Date.now() };
  }
  saveStore(store);
}

export function getCachedMediaPreview(messageId: string): CachedMediaPreview | null {
  const store = loadStore();
  const entry = store[messageId];
  if (!entry || Date.now() - entry.ts > MAX_AGE_MS) return null;
  return entry;
}

function getCachedByFilename(filename: string): CachedMediaPreview | null {
  const store = loadStore();
  const entry = store[`fn:${filename}`];
  if (!entry || Date.now() - entry.ts > MAX_AGE_MS) return null;
  return entry;
}

export function mergeCachedPreview(message: Message): Message & { fileBase64?: string; contentType?: string } {
  const raw = message as Message & { fileBase64?: string; contentType?: string };
  if (message.mediaId || raw.fileBase64) return raw;

  const byId = getCachedMediaPreview(message.id);
  if (byId) {
    return { ...raw, fileBase64: byId.base64, contentType: byId.contentType };
  }

  const filename = message.mediaFilename || (
    /\.(png|jpe?g|gif|webp|heic|mp4|mov|pdf|docx?)$/i.test(message.content || '')
      ? message.content
      : undefined
  );
  if (filename) {
    const byFilename = getCachedByFilename(filename);
    if (byFilename) {
      return { ...raw, fileBase64: byFilename.base64, contentType: byFilename.contentType };
    }
  }

  return raw;
}
