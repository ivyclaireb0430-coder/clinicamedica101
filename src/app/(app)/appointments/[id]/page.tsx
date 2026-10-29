import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { getOpenSlots } from "@/lib/booking";
import { APPOINTMENT_STATUSES, appointmentStatusLabel } from "@/lib/constants";
import { addDays, formatDate, formatDateTime, formatPhp, formatTime, manilaDateString, manilaToUtc, todayManila } from "@/lib/time";
import { BackLink, StatusBadge } from "@/components/ui";
import { reschedule, updateStatus } from "../../calendar/actions";

export default async function AppointmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ booked?: string; rescheduled?: string; error?: string; rdate?: string }>;
}) {
  const user = await requirePermission("booking:read");
  const { id } = await params;
  const sp = await searchParams;
  const appt = await db.appointment.findUnique({ where: { id }, include: { lead: { include: { patient: { select: { id: true, patientNo: true } } } }, consultationType: true } });
  if (!appt) notFound();
  await audit({ userId: user.id, action: "VIEW", entity: "Appointment", entityId: id });

  const open = ["BOOKED", "CONFIRMED"].includes(appt.status);
  const rdate = sp.rdate && /^\d{4}-\d{2}-\d{2}$/.test(sp.rdate) ? sp.rdate : null;
  const slots = open && rdate ? await getOpenSlots(rdate, appt.consultationTypeId) : [];
  const nextDays = Array.from({ length: 14 }, (_, i) => addDays(todayManila(), i));

  return (
    <>
      <BackLink href={`/calendar?date=${manilaDateString(appt.startAt)}`} label="Calendar" />
      {sp.booked && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Booked! Nailagay na rin sa Google Calendar (kung naka-connect).</p>}
      {sp.rescheduled && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Rescheduled.</p>}
      {sp.error === "taken" && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Na-book na ang oras na iyon. Pumili ng iba.</p>}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{formatDateTime(appt.startAt)}</h1>
          <p className="muted">
            {appt.consultationType.name} · {appt.consultationType.durationMin} min · {formatPhp(appt.consultationType.feePhp)}
          </p>
        </div>
        <StatusBadge status={appt.status} label={appointmentStatusLabel(appt.status)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2 text-sm">
          <h2>Patient</h2>
          <Link href={`/leads/${appt.lead.id}`} className="font-medium text-brand-700 hover:underline">
            {appt.lead.firstName} {appt.lead.lastName}
          </Link>
          <div>Mobile: {appt.lead.mobile ?? "—"}</div>
          <div>Booked via: {appt.channel.toLowerCase()}</div>
          <div>Google Calendar: {appt.googleEventId ? "Synced" : "Not synced"}</div>
          {appt.notes && <div>Notes: {appt.notes}</div>}
          {appt.lead.patient && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href={`/patients/${appt.lead.patient.id}`} className="btn-secondary">Patient {appt.lead.patient.patientNo}</Link>
              {can(user.role, "clinical:write") && (
                <Link href={`/patients/${appt.lead.patient.id}/assessments/new?appointmentId=${appt.id}`} className="btn">Start assessment</Link>
              )}
            </div>
          )}
        </section>

        <section className="card space-y-3">
          <h2>Update status</h2>
          <form action={updateStatus.bind(null, appt.id)} className="flex flex-wrap gap-2">
            {APPOINTMENT_STATUSES.filter((s) => !["RESCHEDULED", "BOOKED"].includes(s.key)).map((s) => (
              <button key={s.key} name="status" value={s.key} className={s.key === "NO_SHOW" || s.key === "CANCELLED" ? "btn-secondary" : "btn"} disabled={appt.status === s.key}>
                {s.label}
              </button>
            ))}
          </form>
        </section>

        {open && (
          <section className="card space-y-3 md:col-span-2">
            <h2>Reschedule</h2>
            <form action={`/appointments/${appt.id}`} className="flex gap-2">
              <select name="rdate" className="input" defaultValue={rdate ?? ""}>
                <option value="" disabled>Pumili ng petsa…</option>
                {nextDays.map((d) => (
                  <option key={d} value={d}>{formatDate(manilaToUtc(d, "12:00"))}</option>
                ))}
              </select>
              <button className="btn-secondary shrink-0">Show slots</button>
            </form>
            {rdate && (
              slots.length === 0 ? (
                <p className="muted">Walang bakanteng oras sa araw na ito.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {slots.map((s) => (
                    <form key={s.startAt.toISOString()} action={reschedule.bind(null, appt.id)}>
                      <input type="hidden" name="startAt" value={s.startAt.toISOString()} />
                      <button className="btn-secondary w-full">{formatTime(s.startAt)}</button>
                    </form>
                  ))}
                </div>
              )
            )}
          </section>
        )}
      </div>
    </>
  );
}
