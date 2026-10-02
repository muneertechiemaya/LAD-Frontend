/**
 * Promo Video Feature - API
 *
 * HTTP only. LAD-MAGe is called directly (not through the /api proxy) with the
 * caller's JWT, like the rest of the media generation surface; the service takes
 * the tenant from the token, never from the request.
 */
import { safeStorage } from '../../shared/storage';
import { apiErrorFromResponse } from '../../shared/apiError';
import { getMediaGenUrl } from '../../shared/service-urls';
import type {
  PromoOptions,
  PromoVideoJob,
  StartPromoVideoInput,
  StartPromoVideoResult,
} from './types';

const BASE = '/api/v1/media/promo-videos';

function authHeaders(): Record<string, string> {
  const token = safeStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** What the page can offer, and whether this server can make a video at all. */
export async function getPromoOptions(): Promise<PromoOptions> {
  const res = await fetch(`${getMediaGenUrl()}${BASE}/options`, { headers: authHeaders() });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not load the promo video options.');
  return res.json();
}

/**
 * Start a video. Answers at once with a job id; poll it with getPromoVideo.
 * The server refuses before spending anything: 402 out of credits, 409 one
 * already in progress, 503 a writer / voice / renderer not set up here.
 */
export async function startPromoVideo(input: StartPromoVideoInput): Promise<StartPromoVideoResult> {
  const form = new FormData();
  form.append('product', input.product);
  form.append('format', input.format);
  form.append('seconds', String(input.seconds));
  if (input.goal) form.append('goal', input.goal);
  if (input.audience) form.append('audience', input.audience);
  if (input.tone) form.append('tone', input.tone);
  if (input.ctaLabel) form.append('cta_label', input.ctaLabel);
  if (input.ctaUrl) form.append('cta_url', input.ctaUrl);
  if (input.writer) form.append('writer', input.writer);
  if (input.style) form.append('style', input.style);
  form.append('voice', input.narration ? 'default' : 'none');
  for (const shot of input.screenshots) {
    form.append('screenshots', shot.file, shot.file.name);
    form.append('captions', shot.caption ?? '');
  }
  const res = await fetch(`${getMediaGenUrl()}${BASE}`, { method: 'POST', headers: authHeaders(), body: form });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not start the video.');
  return res.json();
}

/** How a video is going; its URL once done. */
export async function getPromoVideo(jobId: string): Promise<PromoVideoJob> {
  const res = await fetch(`${getMediaGenUrl()}${BASE}/${encodeURIComponent(jobId)}`, { headers: authHeaders() });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not read the video status.');
  return res.json();
}
