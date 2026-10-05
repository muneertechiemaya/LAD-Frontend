'use client';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURE } from '@/lib/page-permissions';

/**
 * Which My Tasks sources apply to this tenant. Chats (waiting, assigned,
 * alerts) need Conversations; content items need Content Studio. Approvals are
 * always asked for (each source is tenant-wide and empty when unused).
 */
export function useTaskSources() {
  const { hasFeature } = useAuth();
  return {
    chats: FEATURE.CONVERSATIONS.some((f) => hasFeature(f)),
    content: FEATURE.CONTENT_STUDIO.some((f) => hasFeature(f)),
  };
}
