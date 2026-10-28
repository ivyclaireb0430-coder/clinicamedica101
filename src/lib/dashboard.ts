import { db } from "./db";
import { addDays, manilaDateString, manilaToUtc, startOfWeek } from "./time";
import { monthRange, receivables } from "./billing";
import { sourceLabel } from "./constants";

export type PeriodKind = "week" | "month";
export type Period = { kind: PeriodKind; start: string; end: string; label: string }; // end is inclusive

const dayFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const d = (s: string) => new Date(`${s}T00:00:00Z`);

/** The week (Mon–Sun) or calendar month containing `date`. */
export function periodFor(kind: PeriodKind, date: string): Period {
  if (kind === "month") {
    const { start, end } = monthRange(date.slice(0, 7));
    return { kind, start, end, label: monthFmt.format(d(start)) };
  }
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return { kind, start, end, label: `${dayFmt.format(d(start))} – ${dayFmt.format(d(end))}, ${end.slice(0, 4)}` };
}

export function previousPeriod(p: Period): Period {
  return periodFor(p.kind, addDays(p.start, -1));
}

export function nextPeriod(p: Period): Period {
  return periodFor(p.kind, addDays(p.end, 1));
}

/** Share as a whole percent, or null when the base is 0. */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export type FunnelRow = { key: string; label: string; inquiries: number; booked: number; attended: number; treatment: number; revenue: number };

type CohortLead = {
  id: string;
  source: string;
  campaign: { id: string; name: string } | null;
  appointments: { status: string }[];
  patient: { plans: { status: string; startedAt: Date | null }[]; payments: { amountPhp: number; voidedAt: Date | null }[] } | null;
};

/**
 * Funnel for a cohort of leads (pure; unit-tested): of the inquiries that came in, how many booked,
 * attended, started treatment, and how much they have paid so far.
 */
export function buildFunnel(leads: CohortLead[], groupBy: (l: CohortLead) => { key: string; label: string }): FunnelRow[] {
  const rows = new Map<string, FunnelRow>();
  for (const l of leads) {
    const g = groupBy(l);
    const r = rows.get(g.key) ?? { ...g, inquiries: 0, booked: 0, attended: 0, treatment: 0, revenue: 0 };
    r.inquiries++;
    if (l.appointments.length) r.booked++;
    if (l.appointments.some((a) => a.status === "ATTENDED")) r.attended++;
    if (l.patient?.plans.some((p) => p.startedAt || ["STARTED", "COMPLETED"].includes(p.status))) r.treatment++;
    r.revenue += (l.patient?.payments ?? []).filter((p) => !p.voidedAt).reduce((s, p) => s + p.amountPhp, 0);
    rows.set(g.key, r);
  }
  return [...rows.values()].sort((a, b) => b.attended - a.attended || b.inquiries - a.inquiries);
}

export function funnelTotal(rows: FunnelRow[]): FunnelRow {
  return rows.reduce(
    (t, r) => ({ ...t, inquiries: t.inquiries + r.inquiries, booked: t.booked + r.booked, attended: t.attended + r.attended, treatment: t.treatment + r.treatment, revenue: t.revenue + r.revenue }),
    { key: "TOTAL", label: "All channels", inquiries: 0, booked: 0, attended: 0, treatment: 0, revenue: 0 },
  );
}

/** Outcome metrics for one period. */
export async function periodMetrics(p: Period) {
  const from = manilaToUtc(p.start, "00:00");
  const to = manilaToUtc(addDays(p.end, 1), "00:00");
  const [inquiries, booked, attended, noShows, startedPlans, attendedAppts, sessions, payments, ar] = await Promise.all([
    db.lead.count({ where: { firstContactAt: { gte: from, lt: to } } }),
    // Reschedules create a new appointment; count only original bookings.
    db.appointment.count({ where: { createdAt: { gte: from, lt: to }, rescheduledFromId: null } }),
    db.appointment.count({ where: { status: "ATTENDED", startAt: { gte: from, lt: to } } }),
    db.appointment.count({ where: { status: "NO_SHOW", startAt: { gte: from, lt: to } } }),
    db.treatmentPlan.findMany({ where: { startedAt: { gte: from, lt: to }, status: { in: ["STARTED", "COMPLETED"] } }, select: { patientId: true } }),
    db.appointment.findMany({ where: { status: "ATTENDED", startAt: { gte: from, lt: to } }, select: { leadId: true, startAt: true } }),
    db.treatmentSession.findMany({ where: { date: { gte: p.start, lte: p.end } }, select: { patientId: true } }),
    db.payment.findMany({ where: { voidedAt: null, date: { gte: p.start, lte: p.end } }, select: { amountPhp: true } }),
    receivables(p.end),
  ]);

  // Returned = patients with a session, or an attended appointment that wasn't their first visit, in the period.
  const returning = new Set(sessions.map((s) => s.patientId));
  if (attendedAppts.length) {
    const earlier = await db.appointment.findMany({
      where: { status: "ATTENDED", leadId: { in: attendedAppts.map((a) => a.leadId) }, startAt: { lt: from } },
      select: { lead: { select: { patient: { select: { id: true } } } } },
    });
    for (const e of earlier) if (e.lead.patient) returning.add(e.lead.patient.id);
  }

  return {
    inquiries, booked, attended, noShows,
    noShowRate: rate(noShows, attended + noShows),
    continuedTreatment: new Set(startedPlans.map((x) => x.patientId)).size,
    returned: returning.size,
    collected: payments.reduce((s, x) => s + x.amountPhp, 0),
    outstanding: ar.total,
  };
}

export type Metrics = Awaited<ReturnType<typeof periodMetrics>>;

/** Funnel by source and by campaign for leads whose first contact was in the period. */
export async function periodFunnel(p: Period) {
  const leads = await db.lead.findMany({
    where: { firstContactAt: { gte: manilaToUtc(p.start, "00:00"), lt: manilaToUtc(addDays(p.end, 1), "00:00") } },
    select: {
      id: true, source: true,
      campaign: { select: { id: true, name: true } },
      appointments: { select: { status: true } },
      patient: { select: { plans: { select: { status: true, startedAt: true } }, payments: { select: { amountPhp: true, voidedAt: true } } } },
    },
  });
  const bySource = buildFunnel(leads, (l) => ({ key: l.source, label: sourceLabel(l.source) }));
  const byCampaign = buildFunnel(leads, (l) => (l.campaign ? { key: l.campaign.id, label: l.campaign.name } : { key: "none", label: "No campaign" }));
  return { bySource, byCampaign, total: funnelTotal(bySource) };
}

/** Manually entered views/likes per campaign for the weeks in the period. */
export async function periodReach(p: Period) {
  const stats = await db.campaignStat.findMany({
    where: { weekStart: { gte: startOfWeek(p.start), lte: p.end } },
    include: { campaign: { select: { name: true, channel: true } } },
  });
  const by = new Map<string, { name: string; channel: string; views: number; likes: number }>();
  for (const s of stats) {
    const r = by.get(s.campaignId) ?? { name: s.campaign.name, channel: s.campaign.channel, views: 0, likes: 0 };
    r.views += s.views;
    r.likes += s.likes;
    by.set(s.campaignId, r);
  }
  return [...by.values()].sort((a, b) => b.views - a.views);
}

/** New inquiries and attended consultations per week, for the trend chart. */
export async function weeklyTrend(endDate: string, weeks = 8) {
  const lastStart = startOfWeek(endDate);
  const firstStart = addDays(lastStart, -7 * (weeks - 1));
  const from = manilaToUtc(firstStart, "00:00");
  const to = manilaToUtc(addDays(lastStart, 7), "00:00");
  const [leads, appts] = await Promise.all([
    db.lead.findMany({ where: { firstContactAt: { gte: from, lt: to } }, select: { firstContactAt: true } }),
    db.appointment.findMany({ where: { status: "ATTENDED", startAt: { gte: from, lt: to } }, select: { startAt: true } }),
  ]);
  return Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(firstStart, i * 7);
    const inWeek = (t: Date) => startOfWeek(manilaDateString(t)) === ws;
    return { week: ws, inquiries: leads.filter((l) => inWeek(l.firstContactAt)).length, attended: appts.filter((a) => inWeek(a.startAt)).length };
  });
}
