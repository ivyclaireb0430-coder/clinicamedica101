import { db } from "@/lib/db";
import { decryptOptional } from "@/lib/crypto";
import { todayManila } from "@/lib/time";
import { ProgressChart } from "@/components/ProgressChart";
import { addProgress } from "../actions";

export async function ProgressTab({ patientId, canWrite }: { patientId: string; canWrite: boolean }) {
  const entries = await db.progressEntry.findMany({
    where: { patientId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { session: { select: { modality: true } } },
  });
  const first = entries[0];
  const last = entries[entries.length - 1];
  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2>Main complaint, 0 (worst) to 10 (best)</h2>
          {first && last && entries.length > 1 && (
            <span className="text-sm text-slate-600">
              {first.score} → <span className="font-semibold">{last.score}</span> over {entries.length} ratings
            </span>
          )}
        </div>
        <ProgressChart points={entries.map((e) => ({ date: e.date, score: e.score }))} />
      </section>

      {canWrite && (
        <section className="card">
          <h2 className="mb-2">Add rating</h2>
          <form action={addProgress.bind(null, patientId)} className="grid gap-2 sm:grid-cols-4">
            <input className="input" type="date" name="date" defaultValue={todayManila()} required />
            <select className="input" name="score" required defaultValue="">
              <option value="" disabled>Score…</option>
              {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input className="input sm:col-span-2" name="notes" placeholder="Notes (optional)" />
            <button className="btn">Save rating</button>
          </form>
          <p className="muted mt-2 text-xs">Puwede ring mag-rate habang nagla-log ng session sa Treatment tab.</p>
        </section>
      )}

      <section className="card">
        <h2 className="mb-2">All ratings</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th className="py-1">Date</th><th>Score</th><th>Visit</th><th>Notes</th></tr></thead>
          <tbody>
            {[...entries].reverse().map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top">
                <td className="py-1 pr-2">{e.date}</td>
                <td className="pr-2 font-medium">{e.score}/10</td>
                <td className="pr-2">{e.session?.modality ?? "—"}</td>
                <td className="whitespace-pre-wrap">{decryptOptional(e.notesEnc) ?? ""}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={4} className="muted py-2">Wala pang rating.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
