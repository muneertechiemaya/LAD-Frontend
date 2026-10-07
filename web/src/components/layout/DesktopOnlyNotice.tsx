'use client';

/**
 * Phone-only stand-in for screens that only work with room to spare — the
 * drag-and-drop flow builders. Render it next to the real screen and hide the
 * real screen below md with CSS (`max-md:hidden`), so it stays mounted and any
 * behaviour it runs (auto-launch, autosave) is unchanged.
 */

import Link from 'next/link';
import { MonitorSmartphone } from 'lucide-react';

export interface DesktopOnlyNoticeProps {
  title: string;
  body: string;
  actions: { href: string; label: string; primary?: boolean }[];
}

export function DesktopOnlyNotice({ title, body, actions }: DesktopOnlyNoticeProps) {
  return (
    <div className="md:hidden flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-blue-950/40 dark:bg-[#071131]">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-white/10 dark:text-white">
          <MonitorSmartphone className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={
                a.primary
                  ? 'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 dark:bg-blue-600 dark:hover:bg-blue-500'
                  : 'inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-blue-950/40 dark:text-slate-200 dark:hover:bg-white/5'
              }
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DesktopOnlyNotice;
