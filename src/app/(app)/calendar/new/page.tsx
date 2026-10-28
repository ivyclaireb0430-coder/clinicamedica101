import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { getOpenSlots } from "@/lib/booking";
import { addDays, formatDate, formatPhp, formatTime, manilaToUtc, todayManila } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { bookAppointment } from "../actions";

export default async function NewBooking({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; typeId?: string; date?: string; error?: string }>;
}) {
  await requirePermission("booking:write");
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") && sp.date! >= todayManila() ? sp.date! : todayManila();
  const [types, leads] = await Promise.all([
    db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.lead.findMany({ where: { stage: { not: "LOST" } }, orderBy: { lastContactAt: "desc" }, take: 200, select: { id: true, firstName: true, lastName: true, mobile: true } }),
  ]);
  const typeId = sp.typeId && types.some((t) => t.id === sp.typeId) ? sp.typeId : types[0]?.id;
  const lead = sp.leadId ? leads.find((l) => l.id === sp.leadId) ?? (await db.lead.findUnique({ where: { id: sp.leadId } })) : null;
  const slots = lead && typeId ? await getOpenSlots(date, typeId) : [];
  const nextDays = Array.from({ length: 14 }, (_, i) => addDays(todayManila(), i));

  return (
    <>
      <BackLink href="/calendar" label="Calendar" />
      <PageHeader title="Book a consultation" />
      {sp.error === "taken" && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Na-book na ang oras na iyon. Pumili ng iba.</p>}

      <form className="card mb-4 grid gap-3 sm:grid-cols-3" action="/calendar/new">
        <div className="sm:col-span-3">
          <label className="label" htmlFor="leadId">Patient / lead</label>
          <select className="input" id="leadId" name="leadId" defaultValue={lead?.id ?? ""} required>
            <option value="" disabled>Pumili…</option>
            {lead && !leads.some((l) => l.id === lead.id) && <option value={lead.id}>{lead.firstName} {lead.lastName}</option>}
            {leads.map((l) => (
              <option key={l.id} value={l.id}>{l.firstName} {l.lastName}{l.mobile ? ` · ${l.mobile}` : ""}</option>
            ))}
          </select>
          <p className="muted mt-1">Wala sa listahan? <Link href="/leads/new" className="text-brand-700 underline">Add new inquiry</Link> first.</p>
        </div>
        <div>
          <label className="label" htmlFor="typeId">Consultation type</label>
          <select className="input" id="typeId" name="typeId" defaultValue={typeId}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name} · {t.durationMin} min · {formatPhp(t.feePhp)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <select className="input" id="date" name="date" defaultValue={date}>
            {nextDays.map((d) => (
              <option key={d} value={d}>{formatDate(manilaToUtc(d, "12:00"))}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-secondary w-full">Show open slots</button>
        </div>
      </form>

      {lead && typeId && (
        <section className="card">
          <h2 className="mb-3">Open slots · {formatDate(manilaToUtc(date, "12:00"))}</h2>
          {slots.length === 0 ? (
            <p className="muted">Walang bakanteng oras sa araw na ito. Subukan ang ibang petsa.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <form key={s.startAt.toISOString()} action={bookAppointment}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="consultationTypeId" value={typeId} />
                  <input type="hidden" name="startAt" value={s.startAt.toISOString()} />
                  <button className="btn-secondary w-full">{formatTime(s.startAt)}</button>
                </form>
              ))}
            </div>
          )}
          <p className="muted mt-3">Booking for {lead.firstName} {lead.lastName}. Tapping a time books it immediately.</p>
        </section>
      )}
    </>
  );
}
