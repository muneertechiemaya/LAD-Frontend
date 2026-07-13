/**
 * BusinessProfile — shared shape for the tenant's 14-field business profile.
 *
 * Persisted as a JSONB blob in `ai_icp_profiles.icp_data` via
 * GET/POST /api/ai-playground. Read by:
 *   - The "ICP Discovery" drawer in advanced-search-ai/page.tsx (chat)
 *   - The onboarding wizard's Company step (form)
 *   - Settings → Business Profile (form)
 *
 * This file is the SINGLE source of truth for the field list and the
 * completeness math. Anywhere that displays "X / 14 fields" must compute
 * it via `computeCompleteness()` so the three surfaces agree.
 *
 * NOTE: the chat also writes a few non-canonical keys (`linkedinUrl`,
 * `blogUrls`, `linkedinAudit`) onto the same JSONB blob. The type uses a
 * permissive index signature so those keys are preserved on round-trip
 * through the form-based surfaces — the form just doesn't render them.
 */

/** All fields the form surfaces edit. Additional keys may be present. */
export interface BusinessProfile {
  // Company half — collected by the wizard's Company step
  companyName?: string;
  industry?: string;
  website?: string;
  valueProposition?: string;
  productsServices?: string;
  targetCustomers?: string;
  // Tenant's own contact details — shared by the agent when a prospect asks
  // how to reach them, and baked into the generated LinkedIn prompt. Optional.
  contactEmail?: string;
  contactPhone?: string;

  // ICP half — collected by the wizard's ICP chat step
  companyDescription?: string;
  icpJobTitles?: string;
  icpCompanySize?: string;
  icpLocations?: string;
  icpPainPoints?: string;
  sampleConversation?: string;
  operatingHours?: string;
  timezone?: string;
  geographicFocus?: string;
  competitors?: string;
  campaignTone?: string;

  /**
   * Allow non-canonical extras the chat may add (linkedinUrl, blogUrls,
   * linkedinAudit, etc.) to round-trip through the form surfaces without
   * being dropped on save.
   */
  [extraKey: string]: string | undefined | unknown;
}

/**
 * Optional fields excluded from the completeness denominator.
 * Match advanced-search-ai/page.tsx:4489 — these are supplementary, not
 * required for the core conversation flow.
 */
export const BUSINESS_PROFILE_OPTIONAL_FIELDS: ReadonlySet<keyof BusinessProfile> = new Set([
  'website',
  'sampleConversation',
  'competitors',
  // Contact details are optional — the agent can hand off to the team when they
  // are absent — so they don't count against the completeness denominator.
  'contactEmail',
  'contactPhone',
]);

/** Fields collected by the wizard's Company step (form). */
export const BUSINESS_PROFILE_COMPANY_HALF: ReadonlyArray<keyof BusinessProfile> = [
  'companyName',
  'industry',
  'website',
  'valueProposition',
  'productsServices',
  'targetCustomers',
  'contactEmail',
  'contactPhone',
];

/** Fields collected by the wizard's ICP chat step. */
export const BUSINESS_PROFILE_ICP_HALF: ReadonlyArray<keyof BusinessProfile> = [
  'companyDescription',
  'icpJobTitles',
  'icpCompanySize',
  'icpLocations',
  'icpPainPoints',
  'sampleConversation',
  'operatingHours',
  'timezone',
  'geographicFocus',
  'competitors',
  'campaignTone',
];

/** Full canonical list (company half ∪ ICP half). */
export const BUSINESS_PROFILE_ALL_FIELDS: ReadonlyArray<keyof BusinessProfile> = [
  ...BUSINESS_PROFILE_COMPANY_HALF,
  ...BUSINESS_PROFILE_ICP_HALF,
];

/** Empty profile with every canonical key initialised to ''. */
export function emptyBusinessProfile(): BusinessProfile {
  const empty: BusinessProfile = {};
  for (const k of BUSINESS_PROFILE_ALL_FIELDS) {
    (empty as Record<string, string>)[k as string] = '';
  }
  return empty;
}

export interface BusinessProfileCompleteness {
  /** How many of the non-optional canonical fields are filled. */
  filled: number;
  /** Always the count of non-optional canonical fields. */
  total: number;
  /** Math.round(100 * filled / total). 0 when total is 0. */
  pct: number;
}

/**
 * Compute completeness over the non-optional canonical fields.
 *
 * "Filled" matches the rule at advanced-search-ai/page.tsx:4495 —
 * a truthy string value (so `''`, `undefined`, and `null` all count as empty).
 * Whitespace-only strings count as empty too, since the chat trims input.
 */
export function computeCompleteness(profile: BusinessProfile | null | undefined): BusinessProfileCompleteness {
  const required = BUSINESS_PROFILE_ALL_FIELDS.filter(
    (k) => !BUSINESS_PROFILE_OPTIONAL_FIELDS.has(k),
  );
  const total = required.length;
  if (!profile || total === 0) {
    return { filled: 0, total, pct: 0 };
  }
  let filled = 0;
  for (const k of required) {
    const v = (profile as Record<string, unknown>)[k as string];
    if (typeof v === 'string' && v.trim().length > 0) {
      filled += 1;
    }
  }
  const pct = Math.round((filled / total) * 100);
  return { filled, total, pct };
}
