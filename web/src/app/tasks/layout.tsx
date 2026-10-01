'use client';
import { ReactNode } from 'react';
import { RequireFeature } from '@/components/RequireFeature';
import { FEATURE } from '@/lib/page-permissions';

export default function TasksLayout({ children }: { children: ReactNode }) {
  return <RequireFeature featureKey={FEATURE.CONVERSATIONS}>{children}</RequireFeature>;
}
