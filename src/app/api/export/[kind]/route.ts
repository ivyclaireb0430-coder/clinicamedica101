import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/csv";
import { periodFor, periodFunnel, periodMetrics, previousPeriod, rate } from "@/lib/dashboard";
import { methodLabel, receivables, AGING_BUCKETS } from "@/lib/billing";
import { followUpKindLabel } from "@/lib/followup";
import { appointmentStatusLabel, sourceLabel, stageLabel } from "@/lib/constants";
import { addDays, manilaDateString, manilaTimeString, manilaToUtc, todayManila } from "@/lib/time";

// CSV exports. None of them include health information (concerns, notes, assessments).
const KINDS: Record<string, Permission> = {
  dashboard: "reports:read",
  leads: "data:export",
  appointments: "data:export",
  payments: "data:export",
  receivables: "data:export",
  followups: "data:export",
  audit: "audit:read",
};

const isDate = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const dt = (d: Date) => `${manilaDateString(d)} ${manilaTimeString(d)}`;

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const session = await auth();
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id } }) : null;
  const perm = KINDS[kind];
  if (!perm) return new Response("Not found", { status: 404 });
  if (!user?.active || !can(user.role, perm)) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const from = isDate(url.searchParams.get("from")) ? url.searchParams.get("from")! : null;
  const to = isDate(url.searchParams.get("to")) ? url.searchParams.get("to")! : null;
  const stamp = todayManila();
  let csv: string;
  let name: string;

  switch (kind) {
    case "dashboard": {
      const period = periodFor(url.searchParams.get("period") === "month" ? "month" : "week", isDate(url.searchParams.get("date")) ? url.searchParams.get("date")! : stamp);
      const prev = previousPeriod(period);
      const [m, p, f] = await Promise.all([periodMetrics(period), periodMetrics(prev), periodFunnel(period)]);
      const metricRows = (Object.keys(m) as (keyof typeof m)[]).map((k) => ["Metric", k, m[k], p[k], "", "", ""]);
      const funnelRows = [...f.bySource, f.total].map((r) => [
        "Funnel by source", r.label, r.inquiries, r.booked, r.attended, r.treatment, r.revenue,
      ]);
      const campaignRows = f.byCampaign.map((r) => ["Funnel by campaign", r.label, r.inquiries, r.booked, r.attended, r.treatment, r.revenue]);
      const conv = [
        ["Conversion", "inquiry_to_booked_pct", rate(f.total.booked, f.total.inquiries)],
        ["Conversion", "booked_to_attended_pct", rate(f.total.attended, f.total.booked)],
        ["Conversion", "attended_to_treatment_pct", rate(f.total.treatment, f.total.attended)],
      ];
      csv = toCsv(
        ["Section", `Name (${period.start} to ${period.end})`, "This period / Inquiries", "Previous period / Booked", "Attended", "Treatment", "Revenue PHP"],
        [...metricRows, ...conv, ...funnelRows, ...campaignRows],
      );
      name = `dashboard-${period.kind}-${period.start}.csv`;
      break;
    }
    case "leads": {
      const rows = await db.lead.findMany({ orderBy: { firstContactAt: "desc" }, include: { campaign: { select: { name: true } } } });
      csv = toCsv(
        ["First contact", "First name", "Last name", "Mobile", "Email", "Source", "Campaign", "Stage", "Lost reason", "Privacy consent", "Last contact"],
        rows.map((l) => [dt(l.firstContactAt), l.firstName, l.lastName, l.mobile, l.email, sourceLabel(l.source), l.campaign?.name, stageLabel(l.stage), l.lostReason, l.privacyConsent ? "yes" : "no", dt(l.lastContactAt)]),
      );
      name = `leads-${stamp}.csv`;
      break;
    }
    case "appointments": {
      const rows = await db.appointment.findMany({
        where: from || to ? { startAt: { ...(from ? { gte: manilaToUtc(from, "00:00") } : {}), ...(to ? { lt: manilaToUtc(addDays(to, 1), "00:00") } : {}) } } : {},
        orderBy: { startAt: "desc" },
        include: { lead: { select: { firstName: true, lastName: true, source: true } }, consultationType: { select: { name: true, feePhp: true } } },
      });
      csv = toCsv(
        ["Date", "Time", "First name", "Last name", "Type", "Fee PHP", "Status", "Booked via", "Source", "Booked on"],
        rows.map((a) => [manilaDateString(a.startAt), manilaTimeString(a.startAt), a.lead.firstName, a.lead.lastName, a.consultationType.name, a.consultationType.feePhp, appointmentStatusLabel(a.status), a.channel, sourceLabel(a.lead.source), dt(a.createdAt)]),
      );
      name = `appointments-${stamp}.csv`;
      break;
    }
    case "payments": {
      const rows = await db.payment.findMany({
        where: { ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
        orderBy: [{ date: "desc" }, { receiptNo: "desc" }],
        include: { patient: { select: { patientNo: true, firstName: true, lastName: true } } },
      });
      csv = toCsv(
        ["Date", "Receipt no.", "OR no.", "Patient no.", "First name", "Last name", "Method", "Reference", "Amount PHP", "Voided", "Void reason"],
        rows.map((p) => [p.date, p.receiptNo, p.orNumber, p.patient.patientNo, p.patient.firstName, p.patient.lastName, methodLabel(p.method), p.reference, p.amountPhp, p.voidedAt ? "yes" : "", p.voidReason]),
      );
      name = `payments-${stamp}.csv`;
      break;
    }
    case "receivables": {
      const r = await receivables(to ?? stamp);
      csv = toCsv(
        ["Patient no.", "First name", "Last name", "Mobile", "Oldest unpaid", ...AGING_BUCKETS.map((b) => `${b} days PHP`), "Total PHP"],
        r.rows.map((x) => [x.patient.patientNo, x.patient.firstName, x.patient.lastName, x.patient.mobile, x.oldest, ...AGING_BUCKETS.map((b) => x.buckets[b]), x.total]),
      );
      name = `receivables-${to ?? stamp}.csv`;
      break;
    }
    case "followups": {
      const rows = await db.followUp.findMany({ orderBy: { dueDate: "asc" }, include: { patient: { select: { patientNo: true, firstName: true, lastName: true, mobile: true } } } });
      csv = toCsv(
        ["Due date", "Type", "Status", "Patient no.", "First name", "Last name", "Mobile", "Reminders sent", "Last reminder", "Last channel"],
        rows.map((f) => [f.dueDate, followUpKindLabel(f.kind), f.status, f.patient.patientNo, f.patient.firstName, f.patient.lastName, f.patient.mobile, f.recallCount, f.lastRecallAt ? dt(f.lastRecallAt) : "", f.lastRecallChannel]),
      );
      name = `followups-${stamp}.csv`;
      break;
    }
    default: {
      const rows = await db.auditLog.findMany({
        where: from || to ? { createdAt: { ...(from ? { gte: manilaToUtc(from, "00:00") } : {}), ...(to ? { lt: manilaToUtc(addDays(to, 1), "00:00") } : {}) } } : {},
        orderBy: { createdAt: "desc" },
        take: 50_000,
        include: { user: { select: { email: true } } },
      });
      csv = toCsv(["Time (Manila)", "User", "Action", "Record type", "Record id", "Detail"], rows.map((a) => [dt(a.createdAt), a.user?.email ?? "system", a.action, a.entity, a.entityId, a.detail]));
      name = `audit-log-${stamp}.csv`;
    }
  }

  await audit({ userId: user.id, action: "EXPORT", entity: "Report", detail: `csv:${kind}` });
  return csvResponse(name, csv);
}
