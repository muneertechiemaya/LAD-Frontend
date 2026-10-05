/** Media Hub (LAD-MAGe) types used outside the Media tab itself. */

export interface GalleryImageGroup {
  generation_id: string;
  urls: string[];
  created_at: string | number;
}

export interface GalleryVideo {
  url: string;
  created_at: string | number;
  duration?: number;
}

export interface Gallery {
  images: GalleryImageGroup[];
  videos: GalleryVideo[];
}

export type ImageJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ImageJob {
  job_id: string;
  status: ImageJobStatus;
  prompt?: string;
  images: { index: number; mime_type: string; url?: string }[];
  error?: string | null;
}

export interface GenerateImageInput {
  prompt: string;
  /** Use the tenant's brand profile (colours, logo, style). Default true. */
  useBrand?: boolean;
}
