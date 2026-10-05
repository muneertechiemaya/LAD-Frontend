'use client';
import { ReactNode } from 'react';
import { RequireFeature } from '@/components/RequireFeature';
import { FEATURE } from '@/lib/page-permissions';

export default function TasksLayout({ children }: { children: ReactNode }) {
  // Conversations or Content Studio: either gives the tenant something to do here.
  return <RequireFeature featureKey={[...FEATURE.CONVERSATIONS, ...FEATURE.CONTENT_STUDIO]}>{children}</RequireFeature>;
}
