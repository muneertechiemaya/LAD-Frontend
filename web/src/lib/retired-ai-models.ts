/**
 * Model ids Google has retired from generateContent, mapped to the live id that
 * replaces them. Mirrors RETIRED_SELECTABLE_MODELS in LAD_backend
 * core/billing/services/llmBillingService.js.
 *
 * gemini-2.0-flash has answered 404 "no longer available" since 2026-07-04.
 * gemini-flash-latest is Google's rolling Flash alias (gemini-3.8-flash on
 * 2026-10-05). ListModels still lists retired ids, so only a live
 * generateContent call proves a replacement works.
 */
const RETIRED_AI_MODELS = new Map<string, string>([
  ['gemini-2.0-flash', 'gemini-flash-latest'],
]);

/** The live replacement for a retired model id, or undefined if it is not retired. */
export function retiredModelReplacement(model?: string | null): string | undefined {
  return model ? RETIRED_AI_MODELS.get(model) : undefined;
}
