'use client';
import { RequireFeature } from '@/components/RequireFeature';

export default function CommunityRoiLayout({ children }: LayoutProps<'/community-roi'>) {
  return <RequireFeature featureKey="community-roi">{children}</RequireFeature>;
}
