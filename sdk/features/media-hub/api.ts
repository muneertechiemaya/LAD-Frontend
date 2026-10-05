/**
 * Media Hub (LAD-MAGe) - API, for features outside the Media tab.
 *
 * HTTP only. LAD-MAGe is called directly (not through the /api proxy) with the
 * caller's JWT, like the promo-video feature; the service takes the tenant from
 * the token, never from the request.
 */
import { safeStorage } from '../../shared/storage';
import { apiErrorFromResponse } from '../../shared/apiError';
import { getMediaGenUrl } from '../../shared/service-urls';
import type { Gallery, GenerateImageInput, ImageJob } from './types';

function authHeaders(): Record<string, string> {
  const token = safeStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Everything the Media Hub has produced in the last `maxAgeDays` (signed URLs, ~7 days). */
export async function getGallery(maxAgeDays = 90): Promise<Gallery> {
  const res = await fetch(`${getMediaGenUrl()}/playground-media/gallery?max_age_days=${maxAgeDays}`, { headers: authHeaders() });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not load your gallery.');
  const body = await res.json();
  return { images: body?.images || [], videos: body?.videos || [] };
}

/**
 * Generate one image and wait for it (the service holds the request up to
 * ~2 minutes). A job still running after the hold comes back as 'processing';
 * poll it with getImageJob. 402 = out of credits, 429 = too many at once.
 */
export async function generateImage(input: GenerateImageInput): Promise<ImageJob> {
  const form = new FormData();
  form.append('prompt', input.prompt);
  form.append('use_brand_context', String(input.useBrand ?? true));
  form.append('return_type', 'url');
  form.append('max_hold_seconds', '110');
  const res = await fetch(`${getMediaGenUrl()}/api/v1/media/generate-image-and-hold`, { method: 'POST', headers: authHeaders(), body: form });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not make the image.');
  return res.json();
}

export async function getImageJob(jobId: string): Promise<ImageJob> {
  const res = await fetch(`${getMediaGenUrl()}/api/v1/media/jobs/${encodeURIComponent(jobId)}?return_type=url`, { headers: authHeaders() });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not read the image status.');
  return res.json();
}
