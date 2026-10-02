'use client';

/**
 * Customize Home — show/hide, reorder and add sections.
 *
 * Edits a draft that the page renders live behind the sheet; the parent saves
 * it when the sheet closes, so a run of arrow taps is one write, not ten.
 */
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import type { HomeLayoutSection } from '@lad/frontend-features/overview';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CHANNEL_LABEL, SECTION_BY_ID, type HomeChannel } from './homeSections';

type ChannelStatus = 'connected' | 'disconnected' | 'unknown';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: HomeLayoutSection[];
  onChange: (next: HomeLayoutSection[]) => void;
  onReset: () => void;
  statuses: Partial<Record<HomeChannel, ChannelStatus>>;
}

const ICON_BTN =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30 max-lg:h-11 max-lg:w-11 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';

function Row({
  section,
  status,
  onUp,
  onDown,
  onToggle,
}: {
  section: HomeLayoutSection;
  status: ChannelStatus | undefined;
  /** Omitted = can't move that way (or, for hidden widgets, no arrows at all). */
  onUp?: () => void;
  onDown?: () => void;
  onToggle: (visible: boolean) => void;
}) {
  const def = SECTION_BY_ID.get(section.id);
  if (!def) return null;
  const waitingOnChannel = def.channel && status !== 'connected';
  const switchId = `home-section-${section.id}`;
  return (
    <li className="flex items-center gap-3 py-2.5">
      {section.visible && (
        <div className="flex shrink-0 flex-col">
          <button type="button" className={ICON_BTN} aria-label={`Move ${def.label} up`} disabled={!onUp} onClick={onUp}>
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ICON_BTN} aria-label={`Move ${def.label} down`} disabled={!onDown} onClick={onDown}>
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-slate-900 dark:text-white">{def.label}</span>
        <span className="block text-xs text-slate-600 dark:text-slate-400">{def.description}</span>
        {waitingOnChannel && section.visible && (
          <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">
            Shows once {CHANNEL_LABEL[def.channel!]} is connected.
          </span>
        )}
      </label>
      <Switch id={switchId} checked={section.visible} onCheckedChange={onToggle} aria-label={`Show ${def.label}`} />
    </li>
  );
}

export function CustomizeHomeSheet({ open, onOpenChange, draft, onChange, onReset, statuses }: Props) {
  const shown = draft.filter((s) => s.visible);
  const hidden = draft.filter((s) => !s.visible);

  /** Swap with the neighbouring *shown* section — hidden ones don't take a slot. */
  const swap = (a: string, b: string) => {
    const next = draft.slice();
    const i = next.findIndex((s) => s.id === a);
    const j = next.findIndex((s) => s.id === b);
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const toggle = (id: string, visible: boolean) => {
    const rest = draft.filter((s) => s.id !== id);
    if (!visible) {
      onChange(draft.map((s) => (s.id === id ? { ...s, visible } : s)));
      return;
    }
    // A newly added widget goes to the bottom of what's shown.
    const lastShown = rest.reduce((at, s, i) => (s.visible ? i : at), -1);
    rest.splice(lastShown + 1, 0, { id, visible: true });
    onChange(rest);
  };

  const statusOf = (id: string) => {
    const ch = SECTION_BY_ID.get(id)?.channel;
    return ch ? statuses[ch] : undefined;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-slate-200 px-5 py-4 text-left dark:border-white/10">
          <SheetTitle>Customize Home</SheetTitle>
          <SheetDescription>Choose what shows and in what order. Saved to your account.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          <h3 className="pt-4 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">On your Home</h3>
          {shown.length === 0 ? (
            <p className="py-3 text-sm text-slate-600 dark:text-slate-400">Nothing yet — switch a section on below.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {shown.map((s, i) => (
                <Row
                  key={s.id}
                  section={s}
                  status={statusOf(s.id)}
                  onUp={i > 0 ? () => swap(s.id, shown[i - 1].id) : undefined}
                  onDown={i < shown.length - 1 ? () => swap(s.id, shown[i + 1].id) : undefined}
                  onToggle={(v) => toggle(s.id, v)}
                />
              ))}
            </ul>
          )}

          {hidden.length > 0 && (
            <>
              <h3 className="pt-6 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Add a widget</h3>
              <ul className="divide-y divide-slate-100 pb-4 dark:divide-white/5">
                {hidden.map((s) => (
                  <Row key={s.id} section={s} status={statusOf(s.id)} onToggle={(v) => toggle(s.id, v)} />
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset to default
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn('inline-flex min-h-11 items-center rounded-lg bg-[#0b1957] px-5 text-sm font-semibold text-white hover:bg-[#13246e] dark:bg-blue-600 dark:hover:bg-blue-500')}
          >
            Done
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CustomizeHomeSheet;
