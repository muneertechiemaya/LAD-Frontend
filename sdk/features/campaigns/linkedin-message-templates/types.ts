/**
 * LinkedIn Message Templates - TypeScript Type Definitions
 */

/**
 * LinkedIn Message Template
 */
export interface LinkedInMessageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  connection_message: string | null;
  followup_message: string | null;
  category: string | null;
  tags: string[] | null;
  is_default: boolean;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

/**
 * Coarse media category for a template attachment.
 */
export type TemplateMediaType = 'image' | 'video' | 'audio' | 'document';

/**
 * Media attachment stored on a template (lives in metadata.media_* on the backend).
 */
export interface TemplateMedia {
  media_url: string;
  media_type?: TemplateMediaType | string | null;
  media_filename?: string | null;
}

/**
 * Result of a template media upload (see uploadTemplateMedia).
 */
export interface TemplateMediaUploadResult {
  success: boolean;
  url: string;
  path: string;
  filename: string;
  media_type: TemplateMediaType | string;
  mime_type: string;
}

/**
 * Request to create new template.
 * Media fields are flat here (media_url/media_type/media_filename); the backend
 * folds them into the template's metadata JSONB.
 */
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  connection_message?: string;
  followup_message?: string;
  category?: string;
  tags?: string[];
  is_default?: boolean;
  is_active?: boolean;
  media_url?: string | null;
  media_type?: TemplateMediaType | string | null;
  media_filename?: string | null;
}

/**
 * Request to update template.
 * Set media_url to null to clear an existing attachment.
 */
export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  connection_message?: string;
  followup_message?: string;
  category?: string;
  tags?: string[];
  is_default?: boolean;
  is_active?: boolean;
  media_url?: string | null;
  media_type?: TemplateMediaType | string | null;
  media_filename?: string | null;
}

/**
 * Filters for querying templates
 */
export interface TemplateFilters {
  is_active?: boolean;
  category?: string;
}

/**
 * Template with personalized messages (for preview)
 */
export interface PersonalizedTemplate {
  template: LinkedInMessageTemplate;
  personalizedConnectionMessage: string | null;
  personalizedFollowupMessage: string | null;
}

/**
 * Template category options
 */
export const TEMPLATE_CATEGORIES = [
  'sales',
  'recruiting',
  'networking',
  'partnership',
  'custom'
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

/**
 * Variable placeholders for personalization
 */
export const MESSAGE_VARIABLES = {
  FIRST_NAME: '{{first_name}}',
  LAST_NAME: '{{last_name}}',
  FULL_NAME: '{{full_name}}',
  COMPANY: '{{company}}',
  TITLE: '{{title}}',
  LOCATION: '{{location}}',
} as const;

/**
 * LinkedIn connection message character limit
 */
export const CONNECTION_MESSAGE_MAX_LENGTH = 300;
