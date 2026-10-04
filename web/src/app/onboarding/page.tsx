'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * `/onboarding` is a forwarder, not a page.
 *
 * It used to render a four-step workflow editor (OnboardingLayout and ~70
 * supporting files) that nothing linked to on purpose any more: the real setup
 * flow is `/onboarding/advanced-search-ai`, and campaign creation is
 * `/campaigns/workflow`. What kept the dead screen reachable was stale links —
 * "Create Campaign" buttons, old bookmarks, and mobile entry points — which
 * dropped people on a disconnected three-card screen instead of the thing they
 * asked for.
 *
 * The editor is gone. This route survives only so those existing links land
 * somewhere correct, which is the same destination `Login.tsx` already sends a
 * legacy `/onboarding` redirect to.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Carry the query through: `?campaignId=` hydrates the saved chat and
    // checkpoint selections for that campaign, so dropping it would silently
    // turn an edit link into a blank new-campaign flow.
    const qs = searchParams.toString();
    router.replace(`/onboarding/advanced-search-ai${qs ? `?${qs}` : ''}`);
  }, [router, searchParams]);

  return null;
}
