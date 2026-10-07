'use client';

/**
 * "Get the app" — installs Mr LAD to the home screen as an app icon.
 *
 *  - Already installed (opened from the icon): says so.
 *  - Android / desktop Chromium with the install prompt captured: one tap.
 *  - iPhone / iPad: Safari has no install API, so step-by-step instructions
 *    (Share → Add to Home Screen). On iOS this is also REQUIRED for alerts.
 *  - Android without a captured prompt (already dismissed, other browser):
 *    the browser-menu instructions.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, MoreVertical, PlusSquare, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  canPromptInstall,
  captureInstallPrompt,
  getPlatform,
  isStandalone,
  onInstallAvailabilityChange,
  promptInstall,
  type Platform,
} from '@/lib/push/pushClient';

export function InstallAppCard({ emphasis = false }: { emphasis?: boolean }) {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    captureInstallPrompt();
    setPlatform(getPlatform());
    setInstalled(isStandalone());
    setCanPrompt(canPromptInstall());
    return onInstallAvailabilityChange(setCanPrompt);
  }, []);

  const onInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) setInstalled(true);
  };

  const frame = emphasis
    ? 'border-[#0B1957] dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#071131]';

  return (
    <section className={`rounded-lg border p-5 sm:p-6 ${frame}`} aria-labelledby="install-app-title">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 id="install-app-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {installed ? 'Mr LAD app is installed' : 'Get the Mr LAD app'}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
            {installed
              ? 'You are using the app from your home screen.'
              : 'Add Mr LAD to your home screen for one-tap access and instant alerts when a lead accepts or replies.'}
          </p>
        </div>
      </div>

      {installed ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Installed
        </p>
      ) : canPrompt ? (
        <Button onClick={onInstall} className="mt-4 w-full sm:w-auto gap-2 bg-[#0B1957] hover:bg-[#0a1540] dark:bg-blue-600 text-white">
          <Download className="h-4 w-4" aria-hidden="true" /> Install app
        </Button>
      ) : platform === 'ios' ? (
        <ol className="mt-4 space-y-3 text-sm text-gray-800 dark:text-slate-200">
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0B1957] text-xs font-bold text-white">1</span>
            <span>Open this page in <strong>Safari</strong> and tap <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" /> <strong>Share</strong>.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0B1957] text-xs font-bold text-white">2</span>
            <span>Choose <PlusSquare className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0B1957] text-xs font-bold text-white">3</span>
            <span>Open <strong>Mr LAD</strong> from your home screen and turn on notifications in Settings → Notifications.</span>
          </li>
        </ol>
      ) : platform === 'android' ? (
        <ol className="mt-4 space-y-3 text-sm text-gray-800 dark:text-slate-200">
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0B1957] text-xs font-bold text-white">1</span>
            <span>Tap the browser menu <MoreVertical className="inline h-4 w-4 align-text-bottom" aria-label="menu" />.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0B1957] text-xs font-bold text-white">2</span>
            <span>Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</span>
          </li>
        </ol>
      ) : (
        <p className="mt-4 text-sm text-gray-700 dark:text-slate-300">
          On your phone, open <strong>{typeof window !== 'undefined' ? window.location.host : 'this site'}/install</strong> to add the app to your home screen.
          In Chrome or Edge on this computer, use the install icon in the address bar.
        </p>
      )}
    </section>
  );
}

export default InstallAppCard;
