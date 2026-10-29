import { db } from "./db";
import { getSetting, setSetting } from "./settings";
import { doctorEmail, sendGmail } from "./google";
import { pctChange } from "./reports";
import { addDays, formatPhp, manilaDateString, manilaTimeString, startOfWeek, weekdayOf } from "./time";
import { periodFor, periodFunnel, periodMetrics, previousPeriod, rate, type FunnelRow, type Metrics, type Period } from "./dashboard";

const LINES: { key: keyof Metrics; label: string; money?: boolean }[] = [
  { key: "inquiries", label: "New inquiries" },
  { key: "booked", label: "Consultations booked" },
  { key: "attended", label: "Patients who attended" },
  { key: "continuedTreatment", label: "Started treatment" },
  { key: "returned", label: "Returned for follow-up" },
  { key: "collected", label: "Collected", money: true },
  { key: "outstanding", label: "Outstanding receivables", money: true },
];

/** Plain-text weekly summary (pure; unit-tested). Numbers only, never patient names or health details. */
export function weeklySummaryText(input: {
  period: Period; prev: Period; m: Metrics; p: Metrics; bySource: FunnelRow[];
  followUpsDue: number; needsDoctor: number; appUrl: string;
}) {
  const { period, prev, m, p } = input;
  const val = (v: number, money?: boolean) => (money ? formatPhp(v) : String(v));
  const lines = [
    `Clinica Medica 101 · Weekly summary`,
    `${period.label} (compared with ${prev.label})`,
    "",
    ...LINES.map(({ key, label, money }) => {
      const now = m[key] as number;
      const before = p[key] as number;
      const pct = pctChange(now, before);
      const change = pct === null ? "new" : pct === 0 ? "same" : `${pct > 0 ? "+" : ""}${pct}%`;
      return `${label}: ${val(now, money)} (${change}, was ${val(before, money)})`;
    }),
    `No-show rate: ${m.noShowRate === null ? "n/a" : `${m.noShowRate}%`} (${m.noShows} no-show${m.noShows === 1 ? "" : "s"})`,
    "",
    "Where this week's inquiries came from (inquiries > booked > attended > treatment, revenue so far):",
    ...(input.bySource.length
      ? input.bySource.map((r) => `- ${r.label}: ${r.inquiries} > ${r.booked} > ${r.attended} > ${r.treatment}, ${formatPhp(r.revenue)}`)
      : ["- No new inquiries"]),
    "",
    `Inquiry to booked: ${fmtRate(input.bySource, "booked", "inquiries")} · Booked to attended: ${fmtRate(input.bySource, "attended", "booked")}`,
    "",
    "To do now:",
    `- Follow-ups due or overdue: ${input.followUpsDue}`,
    `- Messenger chats waiting for the doctor: ${input.needsDoctor}`,
    "",
    `Open the dashboard: ${input.appUrl}/?period=week&date=${period.start}`,
  ];
  return lines.join("\n");
}

function fmtRate(rows: FunnelRow[], part: "booked" | "attended", whole: "inquiries" | "booked") {
  const r = rate(rows.reduce((s, x) => s + x[part], 0), rows.reduce((s, x) => s + x[whole], 0));
  return r === null ? "n/a" : `${r}%`;
}

/** Build and send last week's summary now. */
export async function sendWeeklySummary(now = new Date()) {
  const lastWeek = periodFor("week", addDays(startOfWeek(manilaDateString(now)), -7));
  const prev = previousPeriod(lastWeek);
  const [m, p, funnel, followUpsDue, needsDoctor, configuredTo] = await Promise.all([
    periodMetrics(lastWeek), periodMetrics(prev), periodFunnel(lastWeek),
    db.followUp.count({ where: { status: "OPEN", dueDate: { lte: manilaDateString(now) } } }),
    db.conversation.count({ where: { needsDoctor: true } }),
    getSetting("weeklyEmailTo"),
  ]);
  const to = configuredTo || (await doctorEmail());
  if (!to) return { ok: false, error: "No email address to send to", week: lastWeek.start };
  const text = weeklySummaryText({ period: lastWeek, prev, m, p, bySource: funnel.bySource, followUpsDue, needsDoctor, appUrl: process.env.APP_URL ?? "" });
  const r = await sendGmail(to, `Clinica Medica 101 weekly summary: ${lastWeek.label}`, text);
  return { ...r, week: lastWeek.start, text };
}

/** Called by the reminders cron. Sends once, on Monday from 7 AM Manila time. */
export async function runWeeklySummary(now = new Date()) {
  if ((await getSetting("weeklyEmailEnabled")) !== "1") return { weekly: "off" };
  const today = manilaDateString(now);
  if (weekdayOf(today) !== 1 || Number(manilaTimeString(now).slice(0, 2)) < 7) return { weekly: "not-due" };
  const week = addDays(startOfWeek(today), -7);
  if ((await getSetting("lastWeeklyEmailWeek")) === week) return { weekly: "already-sent" };
  const r = await sendWeeklySummary(now);
  if (r.ok) await setSetting("lastWeeklyEmailWeek", week);
  return { weekly: r.ok ? "sent" : `failed: ${r.error}` };
}
