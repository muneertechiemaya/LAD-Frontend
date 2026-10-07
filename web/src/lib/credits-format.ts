/**
 * Display helpers for credit amounts and the feature / reference names the
 * billing ledger hands back.
 *
 * The ledger stores credits to 4 decimals (1.4193) and names features from raw
 * keys ("Waba Whatsapp Subscription", "Media_generation", "llm_usage"). A client
 * reading their bill should see "1.4 credits" and "WhatsApp Business subscription".
 */

/** 133.865 → "133.9", 1200 → "1,200", 0.0412 → "0.04", 0.002 → "<0.01", 0 → "0". */
export function formatCredits(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 0.01) return `${n < 0 ? '-' : ''}<0.01`;
  // Small AI charges are a few hundredths of a credit - keep two places there.
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: abs < 1 ? 2 : 1 }).format(n);
}

/** "1 credit" / "12.5 credits". */
export function creditsLabel(value: number | string | null | undefined): string {
  const text = formatCredits(value);
  return `${text} ${text === '1' ? 'credit' : 'credits'}`;
}

/** "1 use" / "3 uses". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
}

const WORD_FIXES: Array<[RegExp, string]> = [
  [/\bwaba whatsapp\b/gi, 'WhatsApp Business'],
  [/\bwaba\b/gi, 'WhatsApp Business'],
  [/\bpersonal whatsapp\b/gi, 'Personal WhatsApp'],
  [/\bwhatsapp\b/gi, 'WhatsApp'],
  [/\blinkedin\b/gi, 'LinkedIn'],
  [/\bllm\b/gi, 'AI'],
  [/\bai\b/gi, 'AI'],
  [/\bicp\b/gi, 'ICP'],
  [/\bsms\b/gi, 'SMS'],
];

/**
 * Turn a raw feature / reference key into words a client recognises:
 * "Waba Whatsapp Subscription" → "WhatsApp Business subscription",
 * "Media_generation" → "Media generation", "llm_usage" → "AI usage".
 */
export function billingLabel(raw: string | null | undefined): string {
  if (!raw) return 'Other';
  let s = String(raw).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return 'Other';
  for (const [re, word] of WORD_FIXES) s = s.replace(re, word);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
