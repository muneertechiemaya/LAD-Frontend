/**
 * Content Studio - deterministic voice-rule audit and score maths.
 *
 * The same rules the backend grader applies (ported from the post-grader
 * scorecard), run in the browser so the composer can flag an em dash or a
 * hashtag over the limit while the user types, without a round trip. The
 * dimension scores themselves still come from the server's grade.
 */
import type { GradeDimensions, Platform, VoiceRuleResult } from './types';

export const DIMENSION_WEIGHTS: Record<keyof GradeDimensions, number> = {
  hook: 0.5,
  specificity: 0.1,
  emotion: 0.1,
  shareability: 0.1,
  voice: 0.1,
  polarity: 0.05,
  platformFit: 0.05,
};

export const DIMENSION_LABELS: Record<keyof GradeDimensions, string> = {
  hook: 'Hook',
  specificity: 'Curiosity and specifics',
  emotion: 'Emotion',
  shareability: 'Worth sharing',
  voice: 'Sounds like you',
  polarity: 'Takes a position',
  platformFit: 'Platform fit',
};

export const RULE_LABELS: Record<VoiceRuleResult['rule'], string> = {
  em_dashes: 'No em dashes',
  contractions: 'Contractions',
  numbers_as_digits: 'Numbers as digits',
  active_voice: 'Active voice',
  filler_words: 'No filler words',
  filler_openers: 'No filler openers',
  hashtag_count: 'Hashtag count',
};

/** Hashtag limits per platform: [min, max]. */
export const HASHTAG_LIMITS: Record<Platform, [number, number]> = {
  x: [0, 0],
  facebook: [0, 0],
  linkedin: [0, 5],
  instagram: [3, 5],
  tiktok: [0, 5],
};

const UNCONTRACTED = [
  'do not', 'does not', 'cannot', 'it is', 'you are', 'we are', 'they are',
  'you have', 'we have', 'i am', 'will not', 'is not', 'are not',
];
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const FILLER_WORDS = ['really', 'very', 'just', 'basically', 'literally', 'actually', 'simply'];
const FILLER_OPENERS = ["in today's world", 'let me tell you', 'the truth is', "here's the thing", "in today's fast-paced"];

const words = (s: string) => s.toLowerCase().replace(/[’]/g, "'");

export function auditVoice(text: string, platform: Platform, hashtagCount: number): VoiceRuleResult[] {
  const t = words(text);
  const out: VoiceRuleResult[] = [];

  const dash = /—/.exec(text);
  out.push({ rule: 'em_dashes', pass: !dash, violation: dash ? 'Contains an em dash' : undefined });

  const unc = UNCONTRACTED.find((p) => new RegExp(`\\b${p}\\b`).test(t));
  out.push({ rule: 'contractions', pass: !unc, violation: unc ? `"${unc}"` : undefined });

  // "one" alone is often idiomatic ("the one thing"), so only flag a number word
  // that is followed by a plural noun-ish word, e.g. "three tips".
  const numWord = NUMBER_WORDS.find((w) => new RegExp(`\\b${w}\\s+[a-z]+s\\b`).test(t));
  out.push({ rule: 'numbers_as_digits', pass: !numWord, violation: numWord ? `"${numWord}" should be a digit` : undefined });

  const passive = /\b(was|were|is|are|been|being|be)\s+\w+ed\s+by\b/.exec(t);
  out.push({ rule: 'active_voice', pass: !passive, violation: passive ? `"${passive[0]}"` : undefined });

  const filler = FILLER_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(t));
  out.push({ rule: 'filler_words', pass: !filler, violation: filler ? `"${filler}"` : undefined });

  const opener = FILLER_OPENERS.find((o) => t.includes(o));
  out.push({ rule: 'filler_openers', pass: !opener, violation: opener ? `"${opener}"` : undefined });

  const [min, max] = HASHTAG_LIMITS[platform];
  const tagOk = hashtagCount >= min && hashtagCount <= max;
  out.push({
    rule: 'hashtag_count',
    pass: tagOk,
    violation: tagOk ? undefined : `${hashtagCount} hashtags (${min === max ? `${min}` : `${min} to ${max}`} for this platform)`,
  });
  return out;
}

/** round to 1 decimal without the 8.65 → 8.6 float trap. */
export const round1 = (x: number) => Math.round((x + Number.EPSILON) * 10) / 10;

export function computeScore(d: GradeDimensions, rules: VoiceRuleResult[]): number {
  const weighted = (Object.keys(DIMENSION_WEIGHTS) as (keyof GradeDimensions)[]).reduce(
    (sum, k) => sum + DIMENSION_WEIGHTS[k] * (Number(d[k]) || 0),
    0
  );
  const failures = rules.filter((r) => !r.pass).length;
  return Math.max(0, Math.min(10, round1(weighted - Math.min(3, failures * 0.5))));
}

/** First-3-words test from the hooks skill: fail on throat-clearing openers. */
const WEAK_STARTS = ["here's what i", 'let me tell', "in today's", 'so today i', 'i want to', 'today i want', 'are you ready'];
export function first3Words(hook: string): { words: string; pass: boolean } {
  const w = hook.trim().split(/\s+/).slice(0, 3).join(' ');
  const pass = !!w && !WEAK_STARTS.some((s) => words(w).startsWith(s));
  return { words: w, pass };
}
