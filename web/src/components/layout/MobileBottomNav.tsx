'use client';

/**
 * Phone-only bottom navigation: a floating pill with the most-used pages and a
 * round "Ask Mr LAD" button beside it - the animated LAD logo (AgentVisualizer).
 *
 * It renders from the sidebar's already-filtered nav, so a page the user can't
 * open in the sidebar never appears here either. While visible it publishes
 * its height as --bottom-nav-h, which the app shell uses as bottom padding, so
 * the last row of a page is never trapped under the bar.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBottomNavHidden } from '@/lib/bottom-nav';
import AgentVisualizer from '@/components/ui/AgentVisualizer';

export interface BottomNavSourceItem {
  href: string;
  label: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
}

/** Most-used pages, in bar order. Labels are shortened to fit four across a 320px phone. */
const TABS: { href: string; label: string }[] = [
  { href: '/overview', label: 'Home' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/conversations', label: 'Inbox' },
  { href: '/campaigns', label: 'Outreach' },
];
const ASK_HREF = '/onboarding/advanced-search-ai';

/** Screens with their own bottom-anchored composer, where the bar would cover it. */
const HIDDEN_ON = [ASK_HREF];

const BAR_HEIGHT = '5.5rem'; // pill (3.75rem) + bottom gap + breathing room

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function MobileBottomNav({ nav }: { nav: BottomNavSourceItem[] }) {
  const pathname = usePathname() || '';
  const hiddenByScreen = useBottomNavHidden();

  const byHref = new Map(nav.map((i) => [i.href, i]));
  const tabs = TABS.flatMap((t) => {
    const item = byHref.get(t.href);
    return item ? [{ ...t, icon: item.icon }] : [];
  });
  const canAsk = byHref.has(ASK_HREF);

  const visible =
    !hiddenByScreen && !HIDDEN_ON.some((h) => isActive(pathname, h)) && (tabs.length > 0 || canAsk);

  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.style.setProperty('--bottom-nav-h', `calc(${BAR_HEIGHT} + env(safe-area-inset-bottom, 0px))`);
    else root.style.removeProperty('--bottom-nav-h');
    return () => {
      root.style.removeProperty('--bottom-nav-h');
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <nav
      aria-label="Quick navigation"
      className="md:hidden fixed inset-x-3 z-50 flex items-center gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {tabs.length > 0 && (
        <ul className="flex h-15 min-w-0 flex-1 items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-[0_8px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1433]/90 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {tabs.map((t) => {
            const active = isActive(pathname, t.href);
            const Icon = t.icon;
            return (
              <li key={t.href} className="h-full min-w-0 flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-0.5 rounded-full px-0.5 transition-colors',
                    active
                      ? 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={cn('max-w-full truncate text-[11px] leading-tight tracking-tight max-[359px]:text-[10px]', active ? 'font-semibold' : 'font-medium')}>
                    {t.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {canAsk && (
        <Link
          href={ASK_HREF}
          aria-label="Ask Mr LAD"
          title="Ask Mr LAD"
          className="flex h-15 w-15 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgba(11,25,87,0.25)] backdrop-blur-xl transition active:scale-95 dark:border-white/10 dark:bg-[#0b1433]/90 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          {/* The same animated LAD logo as the AI Assistant's "LAD in Action" rows. */}
          <AgentVisualizer state="idle" size={38} />
        </Link>
      )}
    </nav>
  );
}

export default MobileBottomNav;
