/**
 * "te" → "Telugu", "en-IN" → "English (India)". Voice agents store BCP-47
 * codes, and lists printed them as-is ("TE", "EN-US"). A value that is not a
 * locale code is returned unchanged.
 */
export function languageLabel(code?: string | null): string {
  const raw = String(code ?? '').trim();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/i.test(raw)) return raw;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(raw) ?? raw;
  } catch {
    return raw;
  }
}
