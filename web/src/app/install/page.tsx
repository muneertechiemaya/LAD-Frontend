import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing, MessageSquare, UserCheck, Zap } from 'lucide-react';
import { InstallAppCard } from '@/components/pwa/InstallAppCard';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Add Mr LAD to your phone’s home screen and get an alert whenever a lead accepts or replies.',
};

const BENEFITS = [
  { icon: UserCheck, title: 'Lead accepted', text: 'Know the moment a lead accepts your LinkedIn connection request.' },
  { icon: MessageSquare, title: 'New replies', text: 'See who replied — and the first line — right on your lock screen.' },
  { icon: Zap, title: 'One tap in', text: 'Tap the alert to open that conversation straight away.' },
];

export default function InstallPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">Mr LAD on your phone</h1>
      <p className="mt-2 text-gray-600 dark:text-slate-300">
        Install Mr LAD as an app — no app store needed — and get alerts whenever a lead responds.
      </p>

      <div className="mt-6">
        <InstallAppCard emphasis />
      </div>

      <ul className="mt-8 space-y-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#0B1957] dark:bg-blue-950/40 dark:text-blue-300">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-medium text-gray-900 dark:text-white">{title}</span>
              <span className="block text-sm text-gray-600 dark:text-slate-300">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <BellRing className="h-4 w-4" aria-hidden="true" /> After installing
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
          Open Mr LAD from your home screen, sign in, then go to Settings → Notifications and tap <strong>Turn on alerts</strong>.
        </p>
        <Link
          href="/settings?tab=notifications"
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[#0B1957] px-4 text-sm font-medium text-white hover:bg-[#0a1540] dark:bg-blue-600"
        >
          Open notification settings
        </Link>
      </div>
    </div>
  );
}
