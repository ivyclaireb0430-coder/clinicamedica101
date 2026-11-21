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
        <Stat tone="sky" label="Today's appointments" value={todays.length} href={`/calendar?date=${today}`} />
        <Stat tone="amber" label="Needs follow-up" value={followUps} href="/leads/follow-up" highlight={followUps > 0} />
        <Stat tone="rose" label="Follow-ups due" value={followUpsDue} href="/followups" highlight={followUpsDue > 0} />
        <Stat tone="violet" label="New inquiries this week" value={newThisWeek} href="/leads?stage=NEW" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />Today</h2>
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
          <h2 className="mb-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Pipeline</h2>
          <ul className="space-y-1 text-sm">
            {LEAD_STAGES.map((s) => (
              <li key={s.key}>
                <Link href={`/leads?stage=${s.key}`} className="flex items-center justify-between rounded-md px-1 py-0.5 hover:bg-slate-50 hover:underline">
                  <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STAGE_DOTS[s.key]}`} />{s.label}</span>
                  <b>{counts.find((c) => c.stage === s.key)?._count ?? 0}</b>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {showDashboard && (
        <div className="mt-8">
          <h1 className="mb-3 flex items-center gap-2"><span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 via-sky-500 to-violet-500" />Weekly dashboard</h1>
          <Dashboard period={period} />
        </div>
      )}
    </>
  );
}

const STAGE_DOTS: Record<string, string> = {
  NEW: "bg-sky-500", REPLIED: "bg-indigo-500", FEE_EXPLAINED: "bg-violet-500", BOOKED: "bg-amber-500",
  ATTENDED: "bg-emerald-500", PLAN_ACCEPTED: "bg-green-600", FOLLOW_UP: "bg-teal-500", LOST: "bg-slate-400",
};

// Each tile has its own colour; a tile that needs attention gets a stronger fill and a ring.
const STAT_TONES = {
  sky: { tile: "from-sky-500 to-blue-600", soft: "from-sky-50 to-white", text: "text-sky-700", ring: "ring-sky-300" },
  amber: { tile: "from-amber-400 to-orange-500", soft: "from-amber-50 to-white", text: "text-amber-700", ring: "ring-amber-300" },
  rose: { tile: "from-rose-500 to-pink-600", soft: "from-rose-50 to-white", text: "text-rose-700", ring: "ring-rose-300" },
  violet: { tile: "from-violet-500 to-indigo-600", soft: "from-violet-50 to-white", text: "text-violet-700", ring: "ring-violet-300" },
};

function Stat({ label, value, href, highlight, tone }: { label: string; value: number; href: string; highlight?: boolean; tone: keyof typeof STAT_TONES }) {
  const t = STAT_TONES[tone];
  return highlight ? (
    <Link href={href} className={`block rounded-xl bg-gradient-to-br p-4 text-white shadow-md ring-2 ring-offset-1 ${t.tile} ${t.ring} hover:brightness-105`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium text-white/90">{label}</div>
    </Link>
  ) : (
    <Link href={href} className={`card relative block overflow-hidden bg-gradient-to-br ${t.soft} hover:shadow-md`}>
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.tile}`} aria-hidden="true" />
      <div className={`text-2xl font-bold ${t.text}`}>{value}</div>
      <div className="muted text-xs">{label}</div>
    </Link>
  );
}
