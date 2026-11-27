"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveConsult } from "../actions";

type Rx = { drug: string; form: string; sig: string; qty: string };
const EMPTY: Rx = { drug: "", form: "", sig: "", qty: "" };

export function DoctorReplyForm({ id, draft, suggestVisit = false }: { id: string; draft: string; suggestVisit?: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState(draft);
  const [rx, setRx] = useState<Rx[]>([]);
  const [needsVisit, setNeedsVisit] = useState(suggestVisit);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const set = (i: number, patch: Partial<Rx>) => setRx((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filled = rx.filter((r) => r.drug.trim() || r.sig.trim());

  function approve() {
    setError(null);
    start(async () => {
      const r = await approveConsult(id, { note, rx: filled, needsVisit });
      if (r.error) {
        setConfirm(false);
        return setError(r.error);
      }
      setDone(r.channel ?? "");
      router.refresh();
    });
  }

  if (done !== null) return <p className="rounded bg-emerald-50 p-2 text-emerald-800">✓ Naipadala. Abiso sa pasyente: {done}</p>;

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="note">Mensahe sa pasyente {draft && <span className="font-normal text-violet-700">(AI draft sa estilo ninyo, i-edit)</span>}</label>
        <textarea id="note" className="input" rows={9} value={note} onChange={(e) => setNote(e.target.value)} maxLength={6000} />
      </div>

      <div className="space-y-2">
        <p className="label mb-0">℞ e-Reseta (optional, kayo lang ang magsusulat)</p>
        {rx.map((r, i) => (
          <div key={i} className="space-y-1 rounded-lg border border-slate-200 p-2">
            <div className="flex gap-2">
              <input className="input" placeholder="Generic name (Brand)" value={r.drug} onChange={(e) => set(i, { drug: e.target.value })} maxLength={160} />
              <button type="button" className="text-xs text-red-700 underline" onClick={() => setRx((cur) => cur.filter((_, j) => j !== i))}>Alisin</button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <input className="input col-span-2" placeholder="Strength / form (hal. 500 mg tab)" value={r.form} onChange={(e) => set(i, { form: e.target.value })} maxLength={120} />
              <input className="input" placeholder="Qty" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} maxLength={40} />
            </div>
            <input className="input" placeholder="Sig (hal. 1 tab every 8 hours after meals for 5 days)" value={r.sig} onChange={(e) => set(i, { sig: e.target.value })} maxLength={300} />
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setRx((cur) => [...cur, { ...EMPTY }])} disabled={rx.length >= 12}>+ Magdagdag ng gamot</button>
        <p className="text-xs text-slate-500">Ilalagay ang inyong pangalan, PRC license at PTR (Settings → Online konsulta). Hindi puwede ang dangerous drugs (S2) dito.</p>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
        <input type="checkbox" className="mt-1" checked={needsVisit} onChange={(e) => setNeedsVisit(e.target.checked)} />
        <span>
          <b>Papuntahin sa clinic</b> (kailangan ng physical examination). Makikita ng pasyente ang &quot;Kailangan po kayong makita ni Doc sa clinic&quot; at isang
          <b> Mag-book</b> button.{suggestVisit && <span className="text-violet-700"> (AI suggestion: kailangan ng in-clinic visit)</span>}
        </span>
      </label>

      {error && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
      {!confirm ? (
        <button type="button" className="btn w-full" disabled={pending || !note.trim()} onClick={() => setConfirm(true)}>Approve &amp; ipadala</button>
      ) : (
        <div className="space-y-2 rounded-lg bg-amber-50 p-2">
          <p>Ipapadala sa pasyente ang mensahe{filled.length ? ` at e-reseta (${filled.length} gamot)` : ""}{needsVisit ? ", at papupuntahin siya sa clinic" : ""}. Sigurado po?</p>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" disabled={pending} onClick={approve}>{pending ? "Ipinapadala…" : "Oo, ipadala"}</button>
            <button type="button" className="btn-secondary flex-1" disabled={pending} onClick={() => setConfirm(false)}>Hindi pa</button>
          </div>
        </div>
      )}
    </div>
  );
}
