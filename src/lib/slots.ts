import { manilaToUtc, weekdayOf } from "./time";

export type Interval = { startAt: Date; endAt: Date };
export type Rule = { weekday: number; startTime: string; endTime: string };

export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/**
 * Open slots on one Manila date. Slots start on a fixed grid (stepMin) inside each schedule
 * rule for that weekday, skip blocked dates, past times, and anything overlapping `busy`
 * (clinic appointments + Google Calendar events).
 */
export function openSlots(opts: {
  date: string;
  durationMin: number;
  rules: Rule[];
  blockedDates: string[];
  busy: Interval[];
  now?: Date;
  stepMin?: number;
  minNoticeMin?: number;
}): Interval[] {
  const { date, durationMin, rules, blockedDates, busy } = opts;
  const step = opts.stepMin ?? 30;
  const earliest = new Date((opts.now ?? new Date()).getTime() + (opts.minNoticeMin ?? 60) * 60_000);
  if (blockedDates.includes(date)) return [];

  const slots: Interval[] = [];
  for (const rule of rules.filter((r) => r.weekday === weekdayOf(date))) {
    const ruleEnd = manilaToUtc(date, rule.endTime);
    for (let t = manilaToUtc(date, rule.startTime); ; t = new Date(t.getTime() + step * 60_000)) {
      const slot = { startAt: t, endAt: new Date(t.getTime() + durationMin * 60_000) };
      if (slot.endAt > ruleEnd) break;
      if (slot.startAt < earliest) continue;
      if (busy.some((b) => overlaps(slot, b))) continue;
      slots.push(slot);
    }
  }
  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
