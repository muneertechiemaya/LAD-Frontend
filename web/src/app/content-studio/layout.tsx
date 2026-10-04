'use client';
import { ReactNode } from 'react';
import { RequireFeature } from '@/components/RequireFeature';
import { FEATURE } from '@/lib/page-permissions';

/**
 * Tenant entitlement gate. The sidebar hides the nav item too, but hiding is
 * not access control - a user who types the URL lands here.
 */
export default function ContentStudioLayout({ children }: { children: ReactNode }) {
  return <RequireFeature featureKey={FEATURE.CONTENT_STUDIO}>{children}</RequireFeature>;
}
