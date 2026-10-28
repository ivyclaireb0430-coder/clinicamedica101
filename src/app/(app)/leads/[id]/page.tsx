import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { decryptOptional } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { LEAD_STAGES, LOST_REASONS, appointmentStatusLabel, sourceLabel, stageLabel } from "@/lib/constants";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { BackLink, StatusBadge } from "@/components/ui";
import { ScriptPicker } from "@/components/ScriptPicker";
import { changeStage, markContacted } from "../actions";

export default async function LeadDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePermission("leads:read");
  const { id } = await params;
  const { error } = await searchParams;
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      campaign: true,
      stageChanges: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      appointments: { orderBy: { startAt: "desc" }, include: { consultationType: true } },
    },
  });
  if (!lead) notFound();
  const showConcern = can(user.role, "lead_concern:read");
  await audit({ userId: user.id, action: "VIEW", entity: "Lead", entityId: id });

  const scripts = await db.script.findMany({ orderBy: [{ sortOrder: "asc" }], select: { id: true, title: true, body: true } });
  const next = lead.appointments.find((a) => a.startAt > new Date() && ["BOOKED", "CONFIRMED"].includes(a.status));
  const scriptValues: Record<string, string> = { first_name: lead.firstName };
  if (next) {
    scriptValues.date = formatDate(next.startAt);
    scriptValues.time = formatTime(next.startAt);
  }

  return (
    <>
      <BackLink href="/leads" label="Leads" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{lead.firstName} {lead.lastName}</h1>
          <p className="muted">
            {sourceLabel(lead.source)}
            {lead.campaign ? ` · ${lead.campaign.name}` : ""} · first contact {formatDate(lead.firstContactAt)}
          </p>
        </div>
        <StatusBadge status={lead.stage} label={stageLabel(lead.stage)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2 text-sm">
          <h2>Contact</h2>
          <div>Mobile: {lead.mobile ? <a className="text-brand-700" href={`tel:${lead.mobile}`}>{lead.mobile}</a> : "—"}</div>
          <div>Email: {lead.email ?? "—"}</div>
          <div>Messenger: {lead.psid ? "Connected" : "—"}</div>
          <div>Privacy consent: {lead.privacyConsent ? `Yes (${formatDate(lead.consentAt!)})` : "Not yet"}</div>
          {showConcern && <div>Concern: {decryptOptional(lead.concernEnc) ?? "—"}</div>}
          {lead.notes && <div className="whitespace-pre-wrap">Notes: {lead.notes}</div>}
          {lead.stage === "LOST" && <div>Lost reason: {lead.lostReason}</div>}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={`/leads/${lead.id}/edit`} className="btn-secondary">Edit</Link>
            <Link href={`/calendar/new?leadId=${lead.id}`} className="btn">Book consult</Link>
            <form action={markContacted.bind(null, lead.id)}>
              <button className="btn-secondary">Mark contacted</button>
            </form>
          </div>
        </section>

        <section className="card space-y-3">
          <h2>Move in pipeline</h2>
          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <form action={changeStage.bind(null, lead.id)} className="space-y-2">
            <select name="stage" className="input" defaultValue={lead.stage}>
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select name="lostReason" className="input" defaultValue={lead.lostReason ?? ""}>
              <option value="">Lost reason (only for Inactive/Lost)</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button className="btn w-full sm:w-auto">Update stage</button>
          </form>
        </section>

        <section className="card space-y-3">
          <h2>Send a script</h2>
          <p className="muted">Copy, then paste into Messenger. Auto-send comes in Phase 2.</p>
          <ScriptPicker scripts={scripts} values={scriptValues} />
        </section>

        <section className="card space-y-3">
          <h2>Appointments</h2>
          {lead.appointments.length === 0 ? (
            <p className="muted">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lead.appointments.map((a) => (
                <li key={a.id}>
                  <Link href={`/appointments/${a.id}`} className="flex items-center justify-between gap-2 hover:underline">
                    <span>{formatDateTime(a.startAt)} · {a.consultationType.name}</span>
                    <StatusBadge status={a.status} label={appointmentStatusLabel(a.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-2 md:col-span-2">
          <h2>History</h2>
          <ul className="space-y-1 text-sm">
            {lead.stageChanges.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>{c.fromStage ? `${stageLabel(c.fromStage)} → ` : ""}{stageLabel(c.toStage)}</span>
                <span className="muted">{formatDateTime(c.createdAt)}{c.user ? ` · ${c.user.name}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
