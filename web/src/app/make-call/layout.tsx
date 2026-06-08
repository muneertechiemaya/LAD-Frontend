'use client';
import { RequireFeature } from '@/components/RequireFeature';

export default function MakeCallLayout({ children }: LayoutProps<'/make-call'>) {
  return <RequireFeature featureKey="voice-agent">{children}</RequireFeature>;
}
