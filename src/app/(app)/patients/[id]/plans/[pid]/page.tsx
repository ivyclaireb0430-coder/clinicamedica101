import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { decrypt, decryptOptional } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { planStatusLabel, planTotal, totalSessions } from "@/lib/clinical";
import { formatDate, formatPhp, todayManila } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { PlanForm } from "../../../PlanForm";
import { addSession, recordConsent, savePlan, setPlanStatus } from "../../../actions";

const NEXT_ACTIONS: Record<string, { to: string; label: string; style?: string }[]> = {
  DRAFT: [{ to: "PROPOSED", label: "Mark as proposed to patient" }],
  PROPOSED: [{ to: "ACCEPTED", label: "Patient accepted" }, { to: "DECLINED", label: "Patient declined", style: "btn-secondary" }, { to: "DRAFT", label: "Back to draft", style: "btn-secondary" }],
  ACCEPTED: [{ to: "STARTED", label: "Start treatment" }, { to: "CANCELLED", label: "Cancel plan", style: "btn-secondary" }],
  STARTED: [{ to: "COMPLETED", label: "Mark completed" }, { to: "CANCELLED", label: "Cancel plan", style: "btn-secondary" }],
  DECLINED: [{ to: "PROPOSED", label: "Re-propose", style: "btn-secondary" }],
};

export default async function PlanPage({ params, searchParams }: {
  params: Promise<{ id: string; pid: string }>;
  searchParams: Promise<{ saved?: string; error?: string; consent?: string; session?: string }>;
}) {
  const user = await requirePermission("clinical:read");
  const { id, pid } = await params;
  const sp = await searchParams;
  const plan = await db.treatmentPlan.findUnique({
    where: { id: pid },
    include: {
      patient: true,
      items: { orderBy: { sortOrder: "asc" } },
      consent: { include: { signedForm: true } },
      sessions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!plan || plan.patientId !== id) notFound();
  await audit({ userId: user.id, action: "VIEW", entity: "TreatmentPlan", entityId: pid });
  const editable = ["DRAFT", "PROPOSED", "DECLINED"].includes(plan.status);
  const done = plan.sessions.length;
  const planned = totalSessions(plan.items);

  return (
    <>
      <BackLink href={`/patients/${id}?tab=plans`} label={`${plan.patient.firstName} ${plan.patient.lastName ?? ""}`} />
      <PageHeader
        title={plan.title}
        subtitle={`${plan.patient.patientNo} · ${planStatusLabel(plan.status)} · ${formatPhp(planTotal(plan.items))} · ${done}/${planned} sessions`}
        action={<Link href={`/print/plans/${pid}`} target="_blank" className="btn-secondary">Print / PDF for patient</Link>}
      />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      {sp.consent && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Consent recorded.</p>}
      {sp.session && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Session logged.</p>}
      {sp.error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <section className="card mb-4 space-y-2">
        <h2>Status</h2>
        <form action={setPlanStatus.bind(null, pid)} className="flex flex-wrap items-center gap-2">
          {(NEXT_ACTIONS[plan.status] ?? []).map((a) => (
            <button key={a.to} name="status" value={a.to} className={a.style ?? "btn"}>{a.label}</button>
          ))}
          {plan.status === "PROPOSED" && <input name="declineReason" className="input max-w-xs" placeholder="Decline reason (if declined)" />}
        </form>
        {plan.status === "ACCEPTED" && !plan.consent && <p className="text-sm text-amber-700">Record informed consent below before starting.</p>}
        {plan.declineReason && <p className="muted">Declined: {plan.declineReason}</p>}
      </section>

      {["PROPOSED", "ACCEPTED", "STARTED", "COMPLETED"].includes(plan.status) && (
        <section className="card mb-4 space-y-3 text-sm">
          <h2>Informed consent</h2>
          {plan.consent ? (
            <div className="space-y-1">
              <div>Date: {plan.consent.consentDate} · Explained by {plan.consent.explainedByName}</div>
              <div>Patient acknowledged: {plan.consent.patientAcknowledged ? "Yes" : "No"}</div>
              <p className="whitespace-pre-wrap rounded bg-slate-50 p-2">{plan.consent.acknowledgement}</p>
              {plan.consent.signedForm && (
                <a href={`/api/files/${plan.consent.signedForm.id}`} target="_blank" className="text-brand-700 underline">
                  Signed form: {decrypt(plan.consent.signedForm.filenameEnc)}
                </a>
              )}
            </div>
          ) : (
            <form action={recordConsent.bind(null, pid)} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="consentDate">Date</label>
                <input className="input" id="consentDate" name="consentDate" type="date" defaultValue={todayManila()} required />
              </div>
              <div>
                <label className="label">Explained by</label>
                <input className="input" value={user.name} disabled />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="acknowledgement">What was explained and acknowledged</label>
                <textarea className="input" id="acknowledgement" name="acknowledgement" rows={3} required
                  defaultValue="The plan, number of sessions, schedule, expected total cost, potential benefits, risks, and alternatives (including no treatment) were explained. The patient had the chance to ask questions and agreed to proceed." />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="files">Signed consent form (optional photo or PDF)</label>
                <input className="input" id="files" name="files" type="file" accept="application/pdf,image/*" />
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" name="patientAcknowledged" required /> Patient acknowledged and consented
              </label>
              <div className="sm:col-span-2"><button className="btn">Record consent</button></div>
            </form>
          )}
        </section>
      )}

      {plan.status === "STARTED" || plan.sessions.length > 0 ? (
        <section className="card mb-4 space-y-3">
          <h2>Session log</h2>
          {plan.status === "STARTED" && (
            <form action={addSession.bind(null, pid)} className="grid gap-2 sm:grid-cols-4">
              <input className="input" name="date" type="date" defaultValue={todayManila()} required />
              <select className="input sm:col-span-3" name="modality" required defaultValue="">
                <option value="" disabled>Modality…</option>
                {plan.items.map((i) => (
                  <option key={i.id} value={i.modality}>{i.modality}</option>
                ))}
              </select>
              <textarea className="input sm:col-span-4" name="progressNotes" rows={3} placeholder="Progress notes for this visit" />
              <button className="btn sm:col-span-1">Log session</button>
            </form>
          )}
          <ul className="space-y-2 text-sm">
            {plan.sessions.map((s, i) => (
              <li key={s.id} className="rounded border border-slate-100 p-2">
                <div className="font-medium">#{plan.sessions.length - i} · {s.date} · {s.modality}</div>
                <p className="whitespace-pre-wrap text-slate-700">{decryptOptional(s.progressNotesEnc) ?? "—"}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editable ? (
        <>
          <h2 className="mb-2">Edit plan</h2>
          <PlanForm
            action={savePlan.bind(null, id, pid)}
            items={plan.items}
            values={{
              title: plan.title,
              goals: decryptOptional(plan.goalsEnc),
              schedule: decryptOptional(plan.scheduleEnc),
              benefits: decryptOptional(plan.benefitsEnc),
              risks: decryptOptional(plan.risksEnc),
              alternatives: decryptOptional(plan.alternativesEnc),
            }}
          />
        </>
      ) : (
        <section className="card space-y-3 text-sm">
          <h2>Plan details</h2>
          <table className="w-full text-left">
            <thead className="text-slate-500"><tr><th>Modality</th><th>Sessions</th><th className="text-right">Subtotal</th></tr></thead>
            <tbody>
              {plan.items.map((i) => (
                <tr key={i.id}><td>{i.modality}</td><td>{i.sessions} × {formatPhp(i.unitPricePhp)}</td><td className="text-right">{formatPhp(i.sessions * i.unitPricePhp)}</td></tr>
              ))}
            </tbody>
          </table>
          {([["Goals", plan.goalsEnc], ["Schedule", plan.scheduleEnc], ["Benefits", plan.benefitsEnc], ["Risks", plan.risksEnc], ["Alternatives", plan.alternativesEnc]] as const).map(([label, v]) => (
            <div key={label}><div className="font-medium text-slate-600">{label}</div><p className="whitespace-pre-wrap">{decryptOptional(v) ?? "—"}</p></div>
          ))}
          <p className="muted">Started {plan.startedAt ? formatDate(plan.startedAt) : "—"}. Accepted plans can&apos;t be edited; create a new plan for changes.</p>
        </section>
      )}
    </>
  );
}
