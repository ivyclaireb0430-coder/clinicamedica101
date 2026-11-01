import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { getNumberSetting } from "@/lib/settings";
import { lastVisits } from "@/lib/followup";
import { addDays, formatDate, manilaDateString, todayManila } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { saveRetentionSettings } from "../actions";

const BREACH_STEPS = [
  ["Within 1 hour", "Contain it: change the affected passwords, deactivate the user in More → Users & roles, revoke Meta/Google tokens if leaked, or shut the server down if needed."],
  ["Same day", "Write down what happened: when it was found, what data, how many people, how it happened. Check the Audit log and export it to CSV."],
  ["Same day", "Decide if it is a notifiable breach: sensitive personal information (health data counts) that is likely to cause serious harm to the people involved."],
  ["Within 72 hours", "If notifiable: report to the National Privacy Commission (NPC) and notify the affected patients. Say what happened, what data, what you did, what they can do, and who to contact."],
  ["After", "Fix the cause, restore from backup if data was lost or altered, and keep the incident report (the NPC can ask for it). Review once a year even without incidents."],
];

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ erased?: string; saved?: string }> }) {
  await requirePermission("data:export");
  const sp = await searchParams;
  const [years, months] = await Promise.all([getNumberSetting("retentionPatientYears"), getNumberSetting("retentionLeadMonths")]);
  const today = todayManila();
  const patientCutoff = addDays(today, -Math.round(years * 365.25));
  const leadCutoff = new Date(Date.now() - months * 30.44 * 86_400_000);

  const visits = await lastVisits();
  const oldPatientIds = [...visits.entries()].filter(([, last]) => last && last < patientCutoff).map(([id]) => id);
  const [oldPatients, oldLeads] = await Promise.all([
    db.patient.findMany({ where: { id: { in: oldPatientIds }, NOT: { firstName: "Erased" } }, select: { id: true, patientNo: true, firstName: true, lastName: true } }),
    db.lead.findMany({
      where: { patient: null, lastContactAt: { lt: leadCutoff }, NOT: { firstName: "Erased" } },
      select: { id: true, firstName: true, lastName: true, lastContactAt: true, stage: true },
      orderBy: { lastContactAt: "asc" },
      take: 200,
    }),
  ]);

  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader title="Privacy & data" subtitle="Data Privacy Act (RA 10173): access, erasure, retention, breaches" />
      {sp.erased && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Erased {sp.erased}. Recorded in the audit log.</p>}
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2 text-sm">
          <h2>When someone asks for their data or asks to be deleted</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Confirm it is really them (ask from their registered mobile/email or in person with an ID).</li>
            <li>Open their record (Patients or Leads). At the bottom of the Overview there is a <b>Privacy requests</b> box.</li>
            <li><b>Access:</b> download their data (JSON) and send it to them securely. Answer within 30 days.</li>
            <li><b>Erasure:</b> erase them. Receipts stay for BIR, without their name.</li>
          </ol>
        </section>

        <form action={saveRetentionSettings} className="card space-y-2 text-sm">
          <h2>Retention policy</h2>
          <p className="muted">Records older than this are listed below for you to review. Nothing is deleted automatically.</p>
          <label className="block"><span className="label">Patients: keep for (years after last visit)</span><input className="input" type="number" name="retentionPatientYears" min={1} max={50} defaultValue={years} /></label>
          <label className="block"><span className="label">Inquiries that never became patients: keep for (months after last contact)</span><input className="input" type="number" name="retentionLeadMonths" min={1} max={120} defaultValue={months} /></label>
          <button className="btn">Save</button>
        </form>

        <section className="card text-sm">
          <h2 className="mb-2">Past retention: patients ({oldPatients.length})</h2>
          {oldPatients.length === 0 ? <p className="muted">None. Last visit cutoff: {patientCutoff}.</p> : (
            <ul className="space-y-1">
              {oldPatients.map((p) => (
                <li key={p.id}><Link href={`/patients/${p.id}`} className="text-brand-700 hover:underline">{p.patientNo} · {p.firstName} {p.lastName}</Link> <span className="muted">last visit {visits.get(p.id)}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card text-sm">
          <h2 className="mb-2">Past retention: inquiries ({oldLeads.length})</h2>
          {oldLeads.length === 0 ? <p className="muted">None. Last contact before {manilaDateString(leadCutoff)}.</p> : (
            <ul className="space-y-1">
              {oldLeads.map((l) => (
                <li key={l.id}><Link href={`/leads/${l.id}`} className="text-brand-700 hover:underline">{l.firstName} {l.lastName}</Link> <span className="muted">last contact {formatDate(l.lastContactAt)}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="card text-sm md:col-span-2">
          <h2 className="mb-2">If there is a data breach</h2>
          <ol className="space-y-2">
            {BREACH_STEPS.map(([when, what], i) => (
              <li key={i} className="flex gap-3"><span className="badge h-fit shrink-0 bg-red-100 text-red-700">{when}</span><span>{what}</span></li>
            ))}
          </ol>
          <p className="muted mt-2 text-xs">Full checklist with contacts: docs/BREACH-RESPONSE.md. This is a practical guide, not legal advice; your DPO should confirm current NPC rules.</p>
        </section>
      </div>
    </>
  );
}
