'use client';
import { RequireFeature } from '@/components/RequireFeature';

export default function CampaignsLayout({ children }: LayoutProps<'/campaigns'>) {
  return <RequireFeature featureKey="campaigns">{children}</RequireFeature>;
}
