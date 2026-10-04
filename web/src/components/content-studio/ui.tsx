'use client';
/**
 * Content Studio primitives, on the design board's tokens (see the design
 * board's Main artboard): measured colour pairs, 44px minimum targets, and
 * motion that switches off under prefers-reduced-motion.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ApprovalState, Platform, PostStatus } from '@lad/frontend-features/content-studio';
import { APPROVAL_CHIP, PLATFORM_META, STATUS_META } from '@/lib/content-studio/meta';
import { cn } from '@/lib/utils';

export const tone = {
  ink: 'text-[#0E1530] dark:text-[#E8ECF7]',
  soft: 'text-[#4A5470] dark:text-[#A9B3CC]',
  surface: 'bg-white dark:bg-[#111A3A]',
  line: 'border-[#E3E7F0] dark:border-[#24305A]',
  ground: 'bg-[#F5F6FA] dark:bg-[#070D24]',
  focus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2156D9] focus-visible:ring-offset-2 dark:focus-visible:ring-[#8DB4FF] dark:focus-visible:ring-offset-[#070D24]',
  motion: 'transition-colors duration-150 motion-reduce:transition-none',
};

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const CsButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean; size?: 'md' | 'sm' }
>(function CsButton({ variant = 'secondary', busy, size = 'md', className, children, disabled, ...rest }, ref) {
  const v: Record<BtnVariant, string> = {
    primary:
      'bg-[#0B1957] text-white border-[#0B1957] hover:bg-[#152A7A] dark:bg-[#2563EB] dark:border-[#2563EB] dark:hover:bg-[#1D4FD8]',
    secondary: cn(tone.surface, tone.ink, tone.line, 'hover:bg-[#F5F6FA] dark:hover:bg-[#18234A]'),
    ghost: cn('bg-transparent border-transparent', tone.ink, 'hover:bg-[#ECEEF3] dark:hover:bg-[#18234A]'),
    danger: 'bg-white text-[#A1202B] border-[#F2C9CD] hover:bg-[#FDE4E6] dark:bg-[#111A3A] dark:text-[#FFB3B9] dark:border-[#4A1218]',
  };
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] border font-semibold',
        size === 'sm' ? 'px-3 text-[13px]' : 'px-4 text-sm',
        'disabled:cursor-not-allowed disabled:opacity-60',
        tone.focus,
        tone.motion,
        v[variant],
        className
      )}
      {...rest}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const m = PLATFORM_META[platform];
  return (
    <span
      className={cn('inline-flex h-[22px] min-w-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold text-white', className)}
      style={{ background: m.fill }}
      title={m.label}
    >
      <span aria-hidden>{m.glyph}</span>
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

export function StatusChip({ status, className }: { status: PostStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      title={m.hint}
      className={cn(
        'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold transition-opacity duration-150 motion-reduce:transition-none',
        m.cls,
        className
      )}
    >
      {m.label}
    </span>
  );
}

export function ApprovalChip({ state }: { state: ApprovalState }) {
  if (state !== 'pending') return null;
  return (
    <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold', APPROVAL_CHIP)}>
      Needs approval
    </span>
  );
}

export function SampleChip({ className, label = 'Sample data' }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center whitespace-nowrap rounded-full bg-[#ECEEF3] px-2.5 text-xs font-semibold text-[#3B4256] dark:bg-[#2A3150] dark:text-[#D5DAE6]',
        className
      )}
    >
      {label}
    </span>
  );
}

export function Card({
  className,
  children,
  as: As = 'section',
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'div' | 'aside' }) {
  return (
    <As className={cn('rounded-[14px] border', tone.surface, tone.line, className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ children, className, as: As = 'h2' }: { children: React.ReactNode; className?: string; as?: 'h2' | 'h3' }) {
  return <As className={cn('text-[17px] font-semibold', tone.ink, className)}>{children}</As>;
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-xs font-semibold uppercase tracking-[0.06em]', tone.soft, className)}>{children}</div>;
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <p role="alert" className={cn('rounded-[10px] border border-[#F2C9CD] bg-[#FFF8F8] p-3 text-sm text-[#A1202B] dark:border-[#4A1218] dark:bg-[#2A0E12] dark:text-[#FFB3B9]', className)}>
      {msg}
    </p>
  );
}

/** Segmented control used for tabs and view switches. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex rounded-[10px] border p-1', tone.line, tone.surface, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-11 rounded-lg px-3 text-sm font-semibold',
            tone.focus,
            tone.motion,
            value === o.value ? 'bg-[#0B1957] text-white dark:bg-[#2563EB]' : cn(tone.soft, 'hover:bg-[#ECEEF3] dark:hover:bg-[#18234A]')
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={cn('text-sm font-semibold', tone.ink)}>
        {label}
      </label>
      {children}
      {hint ? <p className={cn('text-xs', tone.soft)}>{hint}</p> : null}
    </div>
  );
}

export const inputCls = cn(
  'min-h-11 w-full rounded-[10px] border px-3 text-[15px]',
  tone.surface,
  tone.ink,
  tone.line,
  'placeholder:text-[#6B7489] dark:placeholder:text-[#7E89A6]',
  tone.focus
);

export const textareaCls = cn(inputCls, 'py-2.5 leading-relaxed');
