type Values = Partial<Record<"chiefComplaint" | "symptoms" | "exam" | "investigations" | "results" | "explained", string | null>>;

const FIELDS: [keyof Values, string, string, number][] = [
  ["chiefComplaint", "Chief complaint", "In the patient's words", 2],
  ["symptoms", "Symptoms & history of present illness", "Onset, duration, triggers, associated symptoms", 5],
  ["exam", "Exam findings", "Vitals, physical exam", 4],
  ["investigations", "Investigations requested", "Labs, imaging, referrals", 3],
  ["results", "Results & interpretation", "Upload result files below", 4],
  ["explained", "Findings explained to patient", "What was discussed and the patient's understanding", 4],
];

export function AssessmentForm({
  action, values = {}, date, appointments, appointmentId,
}: {
  action: (fd: FormData) => Promise<void>;
  values?: Values;
  date: string;
  appointments: { id: string; label: string }[];
  appointmentId?: string | null;
}) {
  return (
    <form action={action} className="card grid gap-4 md:grid-cols-2">
      <div>
        <label className="label" htmlFor="date">Date</label>
        <input className="input" id="date" name="date" type="date" defaultValue={date} required />
      </div>
      <div>
        <label className="label" htmlFor="appointmentId">Linked appointment</label>
        <select className="input" id="appointmentId" name="appointmentId" defaultValue={appointmentId ?? ""}>
          <option value="">None</option>
          {appointments.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>
      {FIELDS.map(([name, label, hint, rows]) => (
        <div key={name} className="md:col-span-2">
          <label className="label" htmlFor={name}>{label}</label>
          <textarea className="input" id={name} name={name} rows={rows} placeholder={hint} defaultValue={values[name] ?? ""} />
        </div>
      ))}
      <div className="md:col-span-2">
        <label className="label" htmlFor="files">Attach results (PDF or photos, 10 MB each)</label>
        <input className="input" id="files" name="files" type="file" multiple accept="application/pdf,image/*" />
      </div>
      <div className="md:col-span-2">
        <button className="btn w-full sm:w-auto">Save assessment</button>
        <p className="muted mt-2 text-xs">Encrypted. Visible only to the doctor and owner. Never sent to Messenger, Google, or AI.</p>
      </div>
    </form>
  );
}
