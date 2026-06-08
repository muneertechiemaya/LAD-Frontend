'use client';
import { RequireFeature } from '@/components/RequireFeature';

export default function FollowUpsLayout({ children }: LayoutProps<'/follow-ups'>) {
  return <RequireFeature featureKey="follow-ups">{children}</RequireFeature>;
}
