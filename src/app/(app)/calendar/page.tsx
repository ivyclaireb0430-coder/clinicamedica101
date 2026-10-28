import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { addDays, formatDate, formatTime, manilaDateString, manilaToUtc, startOfWeek, todayManila } from "@/lib/time";
import { appointmentStatusLabel } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  await requirePermission("booking:read");
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayManila();
  const week = sp.view === "week";
  const from = week ? startOfWeek(date) : date;
  const days = week ? 7 : 1;
  const to = addDays(from, days);

  const [appointments, busy, blocked] = await Promise.all([
    db.appointment.findMany({
      where: { startAt: { gte: manilaToUtc(from, "00:00"), lt: manilaToUtc(to, "00:00") }, status: { notIn: ["RESCHEDULED"] } },
      orderBy: { startAt: "asc" },
      include: { lead: { select: { firstName: true, lastName: true } }, consultationType: { select: { name: true } } },
    }),
    db.externalBusy.findMany({
      where: { startAt: { lt: manilaToUtc(to, "00:00") }, endAt: { gt: manilaToUtc(from, "00:00") } },
      orderBy: { startAt: "asc" },
    }),
    db.blockedDate.findMany({ where: { date: { gte: from, lt: to } } }),
  ]);

  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const step = week ? 7 : 1;
  const link = (d: string, v = week ? "week" : "day") => `/calendar?date=${d}&view=${v}`;

  return (
    <>
      <PageHeader title="Calendar" action={<Link href={`/calendar/new?date=${date}`} className="btn">+ Book</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={link(addDays(date, -step))} className="btn-secondary px-3">‹</Link>
        <Link href={link(todayManila())} className="btn-secondary">Today</Link>
        <Link href={link(addDays(date, step))} className="btn-secondary px-3">›</Link>
        <span className="font-medium">{week ? `Week of ${formatDate(manilaToUtc(from, "12:00"))}` : formatDate(manilaToUtc(date, "12:00"))}</span>
        <div className="ml-auto flex gap-1">
          <Link href={link(date, "day")} className={week ? "btn-secondary" : "btn"}>Day</Link>
          <Link href={link(date, "week")} className={week ? "btn" : "btn-secondary"}>Week</Link>
        </div>
      </div>

      <div className={week ? "grid gap-3 md:grid-cols-7" : "space-y-3"}>
        {dayList.map((d) => {
          const dayAppts = appointments.filter((a) => manilaDateString(a.startAt) === d);
          const dayBusy = busy.filter((b) => manilaDateString(b.startAt) === d);
          const block = blocked.find((b) => b.date === d);
          return (
            <div key={d} className={week ? "card p-2" : ""}>
              {week && (
                <Link href={link(d, "day")} className="mb-2 block text-xs font-semibold text-slate-600">
                  {formatDate(manilaToUtc(d, "12:00"))}
                </Link>
              )}
              {block && <p className="mb-2 rounded bg-slate-100 p-2 text-xs">Closed{block.reason ? `: ${block.reason}` : ""}</p>}
              <ul className="space-y-2">
                {dayAppts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/appointments/${a.id}`} className={`block rounded-lg border border-slate-200 bg-white hover:border-brand-500 ${week ? "p-2 text-xs" : "card p-3"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{formatTime(a.startAt)}</span>
                        {!week && <StatusBadge status={a.status} label={appointmentStatusLabel(a.status)} />}
                      </div>
                      <div>{a.lead.firstName} {a.lead.lastName}</div>
                      <div className="muted text-xs">{a.consultationType.name}</div>
                    </Link>
                  </li>
                ))}
                {dayBusy.map((b) => (
                  <li key={b.id} className="rounded-lg border border-dashed border-slate-300 p-2 text-xs text-slate-500">
                    {formatTime(b.startAt)}–{formatTime(b.endAt)} · Busy (Google Calendar)
                  </li>
                ))}
                {!week && dayAppts.length === 0 && dayBusy.length === 0 && <li className="muted">Walang appointments.</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
