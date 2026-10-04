'use client';
import React, { useEffect, useState } from 'react';
import type { BrandBrief } from '@lad/frontend-features/content-studio';
import { useSaveStudioSettings } from '@lad/frontend-features/content-studio';
import { useBusinessProfile } from '@lad/frontend-features/ai-icp-assistant';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/app-toaster';
import { CsButton, ErrorNote, Field, inputCls, textareaCls, tone } from './ui';
import { cn } from '@/lib/utils';

const VOICES = [
  'warm and personal',
  'witty and dry',
  'raw and honest',
  'professional and clean',
  'playful and irreverent',
  'expert and authoritative',
  'scrappy and underdog',
];

type Step = 'business' | 'customer' | 'primaryCta' | 'strongOpinion' | 'story' | 'voice';
const STEPS: { id: Step; q: string; hint: string; placeholder: string }[] = [
  { id: 'business', q: "What's your business? What do you sell?", hint: 'Plain words. "Handmade soy candles" beats "wellness lifestyle products".', placeholder: 'We help…' },
  { id: 'customer', q: 'Who is your customer? Describe one real person who buys from you.', hint: 'One person, not a demographic. What do they want, and what annoys them?', placeholder: 'A founder of a 20-person firm in Dubai who…' },
  { id: 'primaryCta', q: 'What is the one thing you want someone to do after seeing your posts?', hint: 'One action: book a call, send a message, visit the site.', placeholder: 'Book a 20-minute demo' },
  { id: 'strongOpinion', q: 'What do you believe about your industry that most people in it would argue with?', hint: 'This is what makes posts worth reading. A habit you think is a mistake, advice you ignore.', placeholder: 'Most firms don’t have a lead problem. They have a…' },
  { id: 'story', q: 'Tell me one recent story, win or thing that happened in your business.', hint: 'A real moment. No story yet? Write the question customers ask you most.', placeholder: 'Last month a client…' },
  { id: 'voice', q: 'How do you sound? Pick 2 or 3.', hint: 'Or describe your voice in 5 words.', placeholder: 'Plain, fast, no jargon' },
];

const EMPTY: BrandBrief = { business: '', customer: '', primaryCta: '', strongOpinion: '', storyVault: [], voice: [], voiceWords: '' };

/**
 * The brand brief: 6 questions, one at a time, saved once and used by every
 * post Mr LAD writes. Nothing generates until it exists.
 */
export function BriefDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: BrandBrief | null }) {
  const save = useSaveStudioSettings();
  const { profile } = useBusinessProfile();
  const { push } = useToast();
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<BrandBrief>(initial || EMPTY);
  const [story, setStory] = useState((initial?.storyVault || [])[0] || '');

  // Prefill from the Business Profile the onboarding wizard already captured.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    const base = initial || EMPTY;
    setBrief({
      ...base,
      business: base.business || [profile?.companyName, profile?.productsServices || profile?.valueProposition].filter(Boolean).join(': '),
      customer: base.customer || profile?.targetCustomers || '',
      voiceWords: base.voiceWords || profile?.campaignTone || '',
    });
    setStory((base.storyVault || [])[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cur = STEPS[step];
  const value =
    cur.id === 'story' ? story : cur.id === 'voice' ? brief.voiceWords || '' : (brief[cur.id as keyof BrandBrief] as string) || '';
  const filled = cur.id === 'voice' ? brief.voice.length > 0 || !!brief.voiceWords?.trim() : value.trim().length > 2;

  const set = (v: string) => {
    if (cur.id === 'story') setStory(v);
    else if (cur.id === 'voice') setBrief((b) => ({ ...b, voiceWords: v }));
    else setBrief((b) => ({ ...b, [cur.id]: v }));
  };

  const finish = async () => {
    const vault = [story.trim(), ...(initial?.storyVault || []).slice(1)].filter(Boolean);
    try {
      await save.mutateAsync({ brandBrief: { ...brief, storyVault: vault } });
      push({ variant: 'success', title: 'Brand brief saved', description: 'Every post Mr LAD writes now uses it.' });
      onClose();
    } catch {
      /* shown below */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="flex flex-col gap-4 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!filled) return;
            if (step < STEPS.length - 1) setStep(step + 1);
            else finish();
          }}
        >
          <DialogTitle className="pr-10 text-xl">Your brand brief</DialogTitle>
          <DialogDescription className={tone.soft}>
            Question {step + 1} of {STEPS.length}
          </DialogDescription>
          <div className="h-1.5 w-full rounded-full bg-[#ECEEF3] dark:bg-[#24305A]" aria-hidden>
            <div className="h-1.5 rounded-full bg-[#0B1957] dark:bg-[#8DB4FF]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <Field label={cur.q} hint={cur.hint} htmlFor={`brief-${cur.id}`}>
            {cur.id === 'primaryCta' ? (
              <input id={`brief-${cur.id}`} className={inputCls} value={value} placeholder={cur.placeholder} onChange={(e) => set(e.target.value)} autoFocus />
            ) : cur.id === 'voice' ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Voice">
                  {VOICES.map((v) => {
                    const on = brief.voice.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setBrief((b) => ({ ...b, voice: on ? b.voice.filter((x) => x !== v) : [...b.voice, v].slice(0, 3) }))
                        }
                        className={cn(
                          'min-h-11 rounded-full border px-4 text-sm font-semibold',
                          on ? 'border-[#0B1957] bg-[#0B1957] text-white dark:border-[#2563EB] dark:bg-[#2563EB]' : cn(tone.line, tone.ink, tone.surface)
                        )}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                <input id={`brief-${cur.id}`} className={inputCls} value={value} placeholder={cur.placeholder} onChange={(e) => set(e.target.value)} />
              </div>
            ) : (
              <textarea id={`brief-${cur.id}`} rows={4} className={textareaCls} value={value} placeholder={cur.placeholder} onChange={(e) => set(e.target.value)} autoFocus />
            )}
          </Field>
          <ErrorNote error={save.error} />
          <div className="flex flex-wrap justify-between gap-2">
            <CsButton variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </CsButton>
            {step < STEPS.length - 1 ? (
              <CsButton variant="primary" type="submit" disabled={!filled}>
                Next
              </CsButton>
            ) : (
              <CsButton variant="primary" type="submit" disabled={!filled} busy={save.isPending}>
                Save brief
              </CsButton>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
