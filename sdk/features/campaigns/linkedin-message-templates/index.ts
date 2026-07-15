/**
 * LinkedIn Message Templates Feature - SDK Exports
 * 
 * Export all public APIs, types, and hooks for the LinkedIn message templates feature.
 */

// Types
export type {
  LinkedInMessageTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateFilters,
  PersonalizedTemplate,
  TemplateCategory,
  TemplateMedia,
  TemplateMediaType,
  TemplateMediaUploadResult,
} from './types';

export {
  TEMPLATE_CATEGORIES,
  MESSAGE_VARIABLES,
  CONNECTION_MESSAGE_MAX_LENGTH,
} from './types';

// API Functions
export {
  linkedInMessageTemplateKeys,
  getMessageTemplates,
  getMessageTemplatesQueryOptions,
  getMessageTemplateById,
  getMessageTemplateByIdQueryOptions,
  getDefaultMessageTemplate,
  getDefaultMessageTemplateQueryOptions,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  uploadTemplateMedia,
  saveTemplatesToLocalStorage,
  loadTemplatesFromLocalStorage,
  clearTemplatesFromLocalStorage,
} from './api';

// React Hooks
export {
  useMessageTemplates,
  useMessageTemplate,
  useDefaultMessageTemplate,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
  useDeleteMessageTemplate,
  usePersonalizeMessage,
  useValidateMessageLength,
} from './hooks';
