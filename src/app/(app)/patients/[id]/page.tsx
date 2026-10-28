import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can, type Permission } from "@/lib/roles";
import { decryptJson, decryptOptional } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { CLINICAL_FIELDS, planStatusLabel, planTotal } from "@/lib/clinical";
import { appointmentStatusLabel } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhp } from "@/lib/time";
import { BackLink, StatusBadge } from "@/components/ui";
import { createIntakeLink } from "../actions";
import { BillingTab } from "./BillingTab";
import { FollowUpTab } from "./FollowUpTab";
import { ProgressTab } from "./ProgressTab";

const TABS = [
  { key: "overview", label: "Overview", perm: "leads:read" },
  { key: "intake", label: "Intake", perm: "clinical:read" },
  { key: "assessments", label: "Assessments", perm: "clinical:read" },
  { key: "plans", label: "Treatment", perm: "clinical:read" },
  { key: "progress", label: "Progress", perm: "clinical:read" },
  { key: "followup", label: "Follow-up", perm: "booking:read" },
  { key: "billing", label: "Billing", perm: "billing:read" },
] as const satisfies readonly { key: string; label: string; perm: Permission }[];

const INTAKE_MSG: Record<string, string> = {
  created: "Intake link created. Copy it below and send it to the patient.",
  sent: "Intake link sent via Messenger.",
  nowindow: "Lampas 24 oras na mula sa huling message ng pasyente, kaya hindi ito maipapadala sa Messenger. I-copy ang link at i-text o i-email.",
  failed: "Hindi naipadala sa Messenger. I-copy na lang ang link sa ibaba.",
};

function age(birthDate: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}

export default async function PatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; intake?: string; saved?: string; paid?: string; error?: string; sent?: string }> }) {
  const user = await requirePermission("leads:read");
  const { id } = await params;
  const sp = await searchParams;
  const clinical = can(user.role, "clinical:read");
  const tabs = TABS.filter((t) => can(user.role, t.perm));
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "overview";

  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      lead: { include: { appointments: { orderBy: { startAt: "desc" }, include: { consultationType: true } } } },
      intakeForms: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!patient) notFound();
  // Clinical records are only loaded for roles allowed to see them.
  const [assessments, plans] = clinical
    ? await Promise.all([
        db.assessment.findMany({ where: { patientId: id }, orderBy: { date: "desc" }, include: { _count: { select: { attachments: true } } } }),
        db.treatmentPlan.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" }, include: { items: true, consent: true, _count: { select: { sessions: true } } } }),
      ])
    : [[], []];
  await audit({ userId: user.id, action: "VIEW", entity: "Patient", entityId: id, detail: `tab=${tab}` });

  const submitted = patient.intakeForms.filter((f) => f.status === "SUBMITTED");
  const openLinks = patient.intakeForms.filter((f) => f.status === "SENT" && f.expiresAt > new Date());
  const appUrl = process.env.APP_URL ?? "";

  return (
    <>
      <BackLink href="/patients" label="Patients" />
      <div className="mb-3">
        <h1>{patient.firstName} {patient.lastName}</h1>
        <p className="muted">
          {patient.patientNo}
          {age(patient.birthDate) !== null ? ` · ${age(patient.birthDate)} y/o` : ""}
          {patient.sex ? ` · ${patient.sex.toLowerCase()}` : ""}
          {patient.privacyConsent ? " · privacy consent ✓" : " · no privacy consent yet"}
        </p>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/patients/${id}?tab=${t.key}`}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab !== "billing" && sp.error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
      {tab !== "billing" && sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      {sp.sent && (
        <p className="mb-3 rounded-lg bg-slate-100 p-3 text-sm">
          {sp.sent === "failed" ? "Hindi naipadala: walang available na channel (Messenger 24h, email, o SMS)." : `Sent via ${sp.sent.toLowerCase().replace("_", " ")}.`}
        </p>
      )}
      {sp.intake && <p className="mb-3 rounded-lg bg-slate-100 p-3 text-sm">{INTAKE_MSG[sp.intake] ?? ""}</p>}

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-1 text-sm">
            <h2 className="mb-2">Details</h2>
            <div>Mobile: {patient.mobile ?? "—"}</div>
            <div>Email: {patient.email ?? "—"}</div>
            <div>Birthday: {patient.birthDate ?? "—"}</div>
            <div>Address: {patient.address ?? "—"}</div>
            <div>Occupation: {patient.occupation ?? "—"}</div>
            <div>Emergency contact: {patient.emergencyContact ?? "—"}</div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href={`/patients/${id}/edit`} className="btn-secondary">Edit details</Link>
              {patient.leadId && <Link href={`/leads/${patient.leadId}`} className="btn-secondary">Lead record</Link>}
              {patient.leadId && <Link href={`/calendar/new?leadId=${patient.leadId}`} className="btn">Book</Link>}
            </div>
          </section>

          <section className="card space-y-3 text-sm">
            <h2>Pre-consult form</h2>
            <p className="muted">{submitted.length ? `Submitted ${formatDate(submitted[0].submittedAt!)}.` : "Not submitted yet."}</p>
            {openLinks.map((f) => (
              <div key={f.id} className="rounded bg-slate-50 p-2">
                <div className="break-all font-mono text-xs">{appUrl}/intake/{f.token}</div>
                <div className="muted text-xs">Valid until {formatDate(f.expiresAt)} · <a className="text-brand-700 underline" href={`/intake/${f.token}`} target="_blank">open form (in clinic)</a></div>
              </div>
            ))}
            <form action={createIntakeLink.bind(null, { patientId: id })} className="space-y-2">
              {patient.leadId && (
                <label className="flex items-center gap-2"><input type="checkbox" name="viaMessenger" defaultChecked /> Send via Messenger</label>
              )}
              <button className="btn-secondary">Create intake link</button>
            </form>
          </section>

          <section className="card md:col-span-2">
            <h2 className="mb-2">Appointments</h2>
            <ul className="space-y-1 text-sm">
              {(patient.lead?.appointments ?? []).map((a) => (
                <li key={a.id}>
                  <Link href={`/appointments/${a.id}`} className="flex justify-between gap-2 hover:underline">
                    <span>{formatDateTime(a.startAt)} · {a.consultationType.name}</span>
                    <StatusBadge status={a.status} label={appointmentStatusLabel(a.status)} />
                  </Link>
                </li>
              ))}
              {!patient.lead?.appointments.length && <li className="muted">None.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "intake" && (
        <div className="space-y-4">
          {submitted.length === 0 && <p className="card muted">Wala pang naisumiteng pre-consult form. Gumawa ng link sa Overview tab.</p>}
          {submitted.map((f) => {
            const answers = decryptJson<Record<string, string | undefined>>(f.answersEnc) ?? {};
            return (
              <section key={f.id} className="card space-y-3 text-sm">
                <h2>Submitted {formatDateTime(f.submittedAt!)} · consent v{f.consentVersion}</h2>
                {CLINICAL_FIELDS.map(([k, label]) => (
                  <div key={k}>
                    <div className="font-medium text-slate-600">{label}</div>
                    <p className="whitespace-pre-wrap">{answers[k] || "—"}</p>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {tab === "assessments" && (
        <div className="space-y-3">
          <Link href={`/patients/${id}/assessments/new`} className="btn">+ New assessment</Link>
          {assessments.map((a) => (
            <Link key={a.id} href={`/patients/${id}/assessments/${a.id}`} className="card block hover:border-brand-500">
              <div className="font-medium">{formatDate(a.date)}</div>
              <p className="muted line-clamp-2 text-sm">{decryptOptional(a.chiefComplaintEnc) ?? "No chief complaint recorded"}</p>
              {a._count.attachments > 0 && <span className="badge mt-1">{a._count.attachments} file(s)</span>}
            </Link>
          ))}
          {assessments.length === 0 && <p className="card muted">No assessments yet.</p>}
        </div>
      )}

      {tab === "progress" && <ProgressTab patientId={id} canWrite={can(user.role, "clinical:write")} />}
      {tab === "followup" && <FollowUpTab patientId={id} canWrite={can(user.role, "booking:write")} />}
      {tab === "billing" && (
        <BillingTab patientId={id} canWrite={can(user.role, "billing:write")} canVoid={can(user.role, "billing:void")} sp={sp} />
      )}

      {tab === "plans" && (
        <div className="space-y-3">
          <Link href={`/patients/${id}/plans/new`} className="btn">+ New treatment plan</Link>
          {plans.map((p) => (
            <Link key={p.id} href={`/patients/${id}/plans/${p.id}`} className="card block hover:border-brand-500">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.title}</span>
                <StatusBadge status={p.status === "STARTED" ? "CONFIRMED" : p.status === "DECLINED" ? "CANCELLED" : "BOOKED"} label={planStatusLabel(p.status)} />
              </div>
              <div className="muted text-xs">
                {p.items.map((i) => i.modality).join(", ") || "No modalities yet"} · {formatPhp(planTotal(p.items))} · {p._count.sessions} session(s) logged
                {p.consent ? " · consent ✓" : ""}
              </div>
            </Link>
          ))}
          {plans.length === 0 && <p className="card muted">No treatment plans yet.</p>}
        </div>
      )}
    </>
  );
}
