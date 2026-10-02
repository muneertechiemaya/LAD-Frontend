/**
 * Promo Video Feature - Types
 *
 * Template-mode promo videos, made by LAD-MAGe (/api/v1/media/promo-videos):
 * a model the tenant picks writes a storyboard from a brief and screenshots,
 * fixed templates animate it, and the render lands in the tenant's gallery.
 */

export type PromoFormat = '16:9' | '9:16';
export type PromoSeconds = 30 | 45 | 60 | 90;
/** The job's stages, in order. */
export type PromoStage = 'writing' | 'narrating' | 'composing' | 'rendering' | 'collecting';
export type PromoStatus = 'processing' | 'completed' | 'failed' | 'cancelled';

export const PROMO_STAGES: PromoStage[] = ['writing', 'narrating', 'composing', 'rendering', 'collecting'];

export interface PromoWriter {
  id: string;
  label: string;
  /** False when this server has no key for it: show it, but not as a choice. */
  available: boolean;
}

export interface PromoOptions {
  writers: PromoWriter[];
  default_writer: string;
  voice: { available: boolean };
  formats: PromoFormat[];
  lengths: PromoSeconds[];
  /** False until the render stack is set up on this server: nothing can be made. */
  rendering_available: boolean;
  max_screenshots: number;
}

export interface PromoScreenshot {
  file: File;
  /** What it shows, in a few words. Optional; helps the writer place it. */
  caption?: string;
}

export interface StartPromoVideoInput {
  product: string;
  goal?: string;
  audience?: string;
  tone?: string;
  format: PromoFormat;
  seconds: PromoSeconds;
  ctaLabel?: string;
  ctaUrl?: string;
  /** A writer id from options; omit for the server's default. */
  writer?: string;
  /** Narration on (the server's default voice) or off. */
  narration: boolean;
  screenshots: PromoScreenshot[];
}

export interface StartPromoVideoResult {
  job_id: string;
  status: PromoStatus;
  stage: PromoStage;
  writer: string;
}

export interface PromoScene {
  kind: 'hook' | 'feature' | 'stat' | 'quote' | 'cta';
  headline: string;
  narration: string;
}

export interface PromoVideoJob {
  job_id: string;
  status: PromoStatus;
  stage: PromoStage;
  writer?: string;
  /** Set when the job failed; written for the person reading it. */
  error?: string | null;
  /** The storyboard, once written. */
  scenes?: PromoScene[];
  /** A signed URL, valid for about an hour, once the video is done. */
  video_url?: string;
  blob_path?: string;
  created_at?: number;
  finished_at?: number | null;
}
