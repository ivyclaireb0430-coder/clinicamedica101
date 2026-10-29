import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { LEAD_STAGES, appointmentStatusLabel } from "@/lib/constants";
import { needsFollowUp } from "@/lib/pipeline";
import { getNumberSetting } from "@/lib/settings";
import { addDays, formatDate, formatTime, manilaToUtc, startOfWeek, todayManila } from "@/lib/time";
import { PageHeader, StatusBadge } from "@/components/ui";
import { can } from "@/lib/roles";
import { periodFor } from "@/lib/dashboard";
import { Dashboard } from "./Dashboard";

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string; period?: string; date?: string }> }) {
  const user = await requireUser();
  const { denied, period: kind, date } = await searchParams;
  const showDashboard = can(user.role, "reports:read");
  const period = periodFor(kind === "month" ? "month" : "week", date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayManila());
  const today = todayManila();
  const weekStart = startOfWeek(today);
  const now = new Date();

  const [todays, openLeads, newThisWeek, followUpsDue, counts, followUpDays] = await Promise.all([
    db.appointment.findMany({
      where: { startAt: { gte: manilaToUtc(today, "00:00"), lt: manilaToUtc(addDays(today, 1), "00:00") }, status: { notIn: ["CANCELLED", "RESCHEDULED"] } },
      orderBy: { startAt: "asc" },
      include: { lead: { select: { firstName: true, lastName: true } }, consultationType: { select: { name: true } } },
    }),
    db.lead.findMany({ where: { stage: { in: ["NEW", "REPLIED", "FEE_EXPLAINED"] } }, select: { stage: true, lastContactAt: true } }),
    db.lead.count({ where: { firstContactAt: { gte: manilaToUtc(weekStart, "00:00") } } }),
    db.followUp.count({ where: { status: "OPEN", dueDate: { lte: today } } }),
    db.lead.groupBy({ by: ["stage"], _count: true }),
    getNumberSetting("followUpDays"),
  ]);
  const followUps = openLeads.filter((l) => needsFollowUp(l, followUpDays, now)).length;

  return (
    <>
      <PageHeader title={`Hello, ${user.name}`} subtitle={formatDate(now)} />
      {denied && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Wala kayong access sa page na iyon.</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Today's appointments" value={todays.length} href={`/calendar?date=${today}`} />
        <Stat label="Needs follow-up" value={followUps} href="/leads/follow-up" highlight={followUps > 0} />
        <Stat label="Follow-ups due" value={followUpsDue} href="/followups" highlight={followUpsDue > 0} />
        <Stat label="New inquiries this week" value={newThisWeek} href="/leads?stage=NEW" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-3">Today</h2>
          {todays.length === 0 ? (
            <p className="muted">Walang appointment ngayong araw.</p>
          ) : (
            <ul className="space-y-2">
              {todays.map((a) => (
                <li key={a.id}>
                  <Link href={`/appointments/${a.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                    <span><b>{formatTime(a.startAt)}</b> · {a.lead.firstName} {a.lead.lastName} · {a.consultationType.name}</span>
                    <StatusBadge status={a.status} label={appointmentStatusLabel(a.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3">Pipeline</h2>
          <ul className="space-y-1 text-sm">
            {LEAD_STAGES.map((s) => (
              <li key={s.key}>
                <Link href={`/leads?stage=${s.key}`} className="flex justify-between hover:underline">
                  <span>{s.label}</span>
                  <b>{counts.find((c) => c.stage === s.key)?._count ?? 0}</b>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {showDashboard && (
        <div className="mt-8">
          <h1 className="mb-3">Weekly dashboard</h1>
          <Dashboard period={period} />
        </div>
      )}
    </>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: number; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`card block hover:border-brand-500 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="muted text-xs">{label}</div>
    </Link>
  );
}
