import { LEAD_SOURCES } from "@/lib/constants";

type Campaign = { id: string; name: string };
type Values = {
  firstName?: string; lastName?: string | null; mobile?: string | null; email?: string | null;
  source?: string; campaignId?: string | null; concern?: string | null; notes?: string | null; privacyConsent?: boolean;
};

export function LeadForm({
  action, campaigns, values = {}, showConcern, submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  campaigns: Campaign[];
  values?: Values;
  showConcern: boolean;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="firstName">First name *</label>
        <input className="input" id="firstName" name="firstName" defaultValue={values.firstName} required />
      </div>
      <div>
        <label className="label" htmlFor="lastName">Last name</label>
        <input className="input" id="lastName" name="lastName" defaultValue={values.lastName ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="mobile">Mobile</label>
        <input className="input" id="mobile" name="mobile" type="tel" placeholder="09XX XXX XXXX" defaultValue={values.mobile ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" defaultValue={values.email ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="source">How did they hear about us?</label>
        <select className="input" id="source" name="source" defaultValue={values.source ?? "MESSENGER"}>
          {LEAD_SOURCES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="campaignId">Campaign</label>
        <select className="input" id="campaignId" name="campaignId" defaultValue={values.campaignId ?? ""}>
          <option value="">None</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {showConcern && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="concern">Short health concern</label>
          <input className="input" id="concern" name="concern" maxLength={300} defaultValue={values.concern ?? ""} placeholder="e.g. Recurring headaches, gustong malaman ang root cause" />
          <p className="muted mt-1">Encrypted. Hidden from front desk staff.</p>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="label" htmlFor="notes">Notes (non-medical)</label>
        <textarea className="input" id="notes" name="notes" rows={3} defaultValue={values.notes ?? ""} />
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="privacyConsent" defaultChecked={values.privacyConsent} className="mt-1" />
        <span>Patient agreed to the clinic&apos;s privacy notice (Data Privacy Act) before sharing health details.</span>
      </label>
      <div className="sm:col-span-2">
        <button className="btn w-full sm:w-auto">{submitLabel}</button>
      </div>
    </form>
  );
}
