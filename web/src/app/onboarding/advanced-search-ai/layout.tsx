'use client';
import { RequireFeature } from '@/components/RequireFeature';

export default function AdvancedSearchAiLayout({ children }: LayoutProps<'/onboarding/advanced-search-ai'>) {
  return <RequireFeature featureKey="ai-chat">{children}</RequireFeature>;
}
