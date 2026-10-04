/**
 * Timezone helpers for the content calendar.
 *
 * Posts are stored as UTC instants and shown in the tenant's timezone (default
 * Asia/Dubai), not the browser's - a founder planning on a laptop in London
 * still posts on Dubai time. Built on Intl only; no date library needed.
 */

export const DEFAULT_TZ = 'Asia/Dubai';

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return {
    y: Number(o.year),
    m: Number(o.month),
    d: Number(o.day),
    h: Number(o.hour),
    min: Number(o.minute),
    s: Number(o.second),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' of an instant in a timezone. */
export function localDate(iso: string | Date, tz = DEFAULT_TZ): string {
  const p = parts(typeof iso === 'string' ? new Date(iso) : iso, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** 'HH:MM' (24h) of an instant in a timezone. */
export function localTime(iso: string | Date, tz = DEFAULT_TZ): string {
  const p = parts(typeof iso === 'string' ? new Date(iso) : iso, tz);
  return `${pad(p.h)}:${pad(p.min)}`;
}

/** '10:15am' style, the way people say it. */
export function friendlyTime(iso: string | Date, tz = DEFAULT_TZ): string {
  const p = parts(typeof iso === 'string' ? new Date(iso) : iso, tz);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  const ap = p.h < 12 ? 'am' : 'pm';
  return p.min === 0 ? `${h12}${ap}` : `${h12}:${pad(p.min)}${ap}`;
}

/** 'HH:MM' (24h wall time) → '6:30pm', matching friendlyTime. */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'am' : 'pm';
  return m === 0 ? `${h12}${ap}` : `${h12}:${pad(m)}${ap}`;
}

/** Offset (ms) of a timezone at an instant: local wall time minus UTC. */
function offsetMs(at: Date, tz: string): number {
  const p = parts(at, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Wall-clock date + time in a timezone → ISO UTC. Two passes so DST edges land right. */
export function zonedToUtcIso(date: string, time: string, tz = DEFAULT_TZ): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const first = guess - offsetMs(new Date(guess), tz);
  const second = guess - offsetMs(new Date(first), tz);
  return new Date(second).toISOString();
}

/** Add days to a 'YYYY-MM-DD' (calendar arithmetic, timezone-free). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Monday … 6 = Sunday for a 'YYYY-MM-DD'. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function weekdayName(date: string, short = false): string {
  const n = WEEKDAYS[weekdayIndex(date)];
  return short ? n.slice(0, 3) : n;
}

export function monthName(month1: number, short = false): string {
  const n = MONTHS[month1 - 1];
  return short ? n.slice(0, 3) : n;
}

/** 'Sunday 4 October' */
export function longDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${weekdayName(date)} ${d} ${monthName(m)}`;
}

/** 'Sun 4 Oct' */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${weekdayName(date, true)} ${d} ${monthName(m, true)}`;
}

/** Monday of the week containing a date. */
export function startOfWeek(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(date: string): number {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function todayLocal(tz = DEFAULT_TZ): string {
  return localDate(new Date(), tz);
}

/** "Good morning" / "Good afternoon" / "Good evening" for the tenant's clock. */
export function greeting(tz = DEFAULT_TZ): string {
  const h = parts(new Date(), tz).h;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Human list: "Tuesday and Thursday", "Mon, Tue and Thu". */
export function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
