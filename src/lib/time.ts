// Asia/Manila is UTC+8 all year (no daylight saving), so a fixed offset is exact.
export const MANILA_OFFSET_MIN = 8 * 60;
const OFFSET_MS = MANILA_OFFSET_MIN * 60_000;

/** "YYYY-MM-DD" for the Manila calendar day containing `d`. */
export function manilaDateString(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** "HH:MM" Manila wall-clock time. */
export function manilaTimeString(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** Weekday (0 = Sunday) of a Manila date string. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** UTC instant for a Manila date + "HH:MM". */
export function manilaToUtc(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function todayManila(now = new Date()): string {
  return manilaDateString(now);
}

const dateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

export function formatDate(d: Date): string {
  return dateFmt.format(d);
}

export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)}, ${formatTime(d)}`;
}

export function formatPhp(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(amount);
}
