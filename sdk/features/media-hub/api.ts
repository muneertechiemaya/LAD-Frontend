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
import type { Gallery, GenerateImageInput, ImageJob, ReferenceStatus } from './types';

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

/** The image maker's reference images, including the ones synced from the Drive folder. */
export async function getReferences(): Promise<ReferenceStatus> {
  const res = await fetch(`${getMediaGenUrl()}/brand-assets/status`, { headers: authHeaders() });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not load your reference images.');
  const b = await res.json();
  return { drive_connected: !!b?.drive_connected, folder_url: b?.folder_url ?? null, assets: b?.assets || [] };
}

/** Use (or stop using) one reference image, e.g. a Drive photo. */
export async function toggleReference(assetId: string, enabled: boolean): Promise<void> {
  const res = await fetch(`${getMediaGenUrl()}/brand-assets/toggle`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId, enabled }),
  });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not change that reference image.');
}

/**
 * Build the Media brand profile from text instead of a website (the brand
 * brief's answers). Two steps on the service: read the text into a corpus,
 * then synthesise and save the profile from the corpus plus the answers.
 */
export async function buildBrandProfileFromText(input: { text: string; answers: Record<string, string>; brandName?: string }): Promise<{ domain?: string }> {
  const form = new FormData();
  form.append('pasted_text', input.text);
  const read = await fetch(`${getMediaGenUrl()}/mage/wizard/read`, { method: 'POST', headers: authHeaders(), body: form });
  if (!read.ok) throw await apiErrorFromResponse(read, 'Could not read the brief.');
  const { corpus } = await read.json();
  const res = await fetch(`${getMediaGenUrl()}/mage/wizard/build`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ corpus: corpus || input.text, answers: input.answers, brand_name: input.brandName || '' }),
  });
  if (!res.ok) throw await apiErrorFromResponse(res, 'Could not build the brand profile.');
  return res.json();
}
