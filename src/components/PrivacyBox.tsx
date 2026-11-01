import { erasePersonAction } from "@/app/(app)/settings/actions";

/** Owner-only: data-access export and erasure for one person. */
export function PrivacyBox({ patientId, leadId, confirmWord, showConfirmError }: { patientId?: string; leadId?: string; confirmWord: string; showConfirmError?: boolean }) {
  const q = patientId ? `patientId=${patientId}` : `leadId=${leadId}`;
  return (
    <section className="card space-y-3 text-sm">
      <h2>Privacy requests</h2>
      <p className="muted">Para sa request ng tao sa ilalim ng Data Privacy Act. Naka-record ito sa audit log.</p>
      <a href={`/api/privacy/export?${q}`} className="btn-secondary inline-block">Download all their data (JSON)</a>
      <details>
        <summary className="cursor-pointer font-medium text-red-700">Erase this person…</summary>
        <div className="mt-2 space-y-2">
          <p>
            Buburahin: health info, intake, assessments, treatment records, Messenger messages, files, at contact details.
            Mananatili ang resibo at bayad (kailangan sa BIR) pero walang pangalan. Hindi na ito maibabalik.
          </p>
          {showConfirmError && <p className="rounded bg-red-50 p-2 text-red-700">I-type nang tama ang {confirmWord} at ilagay ang dahilan.</p>}
          <form action={erasePersonAction.bind(null, { patientId, leadId, confirmWord })} className="space-y-2">
            <input className="input" name="reason" required maxLength={100} placeholder="Reason, e.g. request by patient via email on Nov 3 (no health details)" />
            <input className="input" name="confirm" required placeholder={`Type ${confirmWord} to confirm`} autoComplete="off" />
            <button className="btn-danger">Erase permanently</button>
          </form>
        </div>
      </details>
    </section>
  );
}
