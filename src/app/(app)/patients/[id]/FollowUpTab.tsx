import Link from "next/link";
import { db } from "@/lib/db";
import { FOLLOW_UP_KINDS, followUpKindLabel, followUpStatus } from "@/lib/followup";
import { addDays, formatDateTime, todayManila } from "@/lib/time";
import { addFollowUp, sendFeedbackRequest, sendFollowUpNow, setFollowUpStatus } from "../../followups/actions";

export async function FollowUpTab({ patientId, canWrite }: { patientId: string; canWrite: boolean }) {
  const [followUps, feedback] = await Promise.all([
    db.followUp.findMany({ where: { patientId }, orderBy: [{ status: "desc" }, { dueDate: "asc" }] }),
    db.feedback.findMany({ where: { patientId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const back = `/patients/${patientId}?tab=followup`;
  const open = followUps.filter((f) => f.status === "OPEN");
  const closed = followUps.filter((f) => f.status !== "OPEN").slice(0, 10);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card space-y-3 text-sm">
        <h2>Follow-up schedule</h2>
        {open.length === 0 && <p className="muted">Walang naka-schedule na follow-up.</p>}
        <ul className="space-y-2">
          {open.map((f) => (
            <li key={f.id} className="rounded border border-slate-100 p-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{f.dueDate} · {followUpKindLabel(f.kind)}</span>
                <span className={`badge ${f.dueDate < todayManila() ? "bg-red-100 text-red-700" : ""}`}>{followUpStatus(f)}</span>
              </div>
              {f.note && <div className="muted">{f.note}</div>}
              <div className="muted text-xs">
                {f.recallCount ? `${f.recallCount} reminder(s) sent, last ${formatDateTime(f.lastRecallAt!)} via ${f.lastRecallChannel?.toLowerCase()}` : "No reminder sent yet"}
                {f.lastRecallError ? ` · ${f.lastRecallError}` : ""}
              </div>
              {canWrite && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={sendFollowUpNow.bind(null, f.id, back)}><button className="btn-secondary">Send reminder now</button></form>
                  <form action={setFollowUpStatus.bind(null, f.id, "DONE", back)}><button className="btn-secondary">Mark done</button></form>
                  <form action={setFollowUpStatus.bind(null, f.id, "CANCELLED", back)}><button className="btn-secondary">Cancel</button></form>
                </div>
              )}
            </li>
          ))}
        </ul>
        {closed.length > 0 && (
          <details>
            <summary className="muted cursor-pointer">Past follow-ups ({closed.length})</summary>
            <ul className="mt-2 space-y-1">
              {closed.map((f) => <li key={f.id} className="muted">{f.dueDate} · {followUpKindLabel(f.kind)} · {followUpStatus(f)}</li>)}
            </ul>
          </details>
        )}
      </section>

      {canWrite && (
        <section className="card space-y-3 text-sm">
          <h2>Add follow-up</h2>
          <form action={addFollowUp.bind(null, patientId)} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="date" name="dueDate" required defaultValue={addDays(todayManila(), 7)} />
              <select className="input" name="kind" defaultValue="NEXT_SESSION">
                {FOLLOW_UP_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </div>
            <input className="input" name="note" maxLength={200} placeholder="Scheduling note (walang clinical details)" />
            <button className="btn">Add follow-up</button>
          </form>
          <p className="muted text-xs">
            Automatic reminder: 1 araw bago ang due date (kung wala pang booking), tapos bawat linggo kapag lampas na, hanggang 3 beses.
          </p>
          <hr className="border-slate-100" />
          <h2>Feedback</h2>
          <ul className="space-y-1">
            {feedback.map((f) => (
              <li key={f.id} className="muted">
                Requested {formatDateTime(f.createdAt)} · {f.submittedAt ? `answered (${f.rating}★)` : "not answered yet"}
              </li>
            ))}
            {feedback.length === 0 && <li className="muted">Wala pang feedback request.</li>}
          </ul>
          <form action={sendFeedbackRequest.bind(null, patientId, back)}>
            <button className="btn-secondary">Send feedback request</button>
          </form>
          <Link href="/followups" className="text-brand-700 underline">All follow-ups →</Link>
        </section>
      )}
    </div>
  );
}
