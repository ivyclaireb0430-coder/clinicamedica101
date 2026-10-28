import Link from "next/link";
import {
  AGING_BUCKETS, CHARGE_CATEGORIES, PAYMENT_METHODS, categoryLabel, methodLabel, packageActive, packageRemaining, patientLedger,
} from "@/lib/billing";
import { formatPhp, todayManila } from "@/lib/time";
import { addCharge, recordPayment, sellPackage, usePackage, voidCharge, voidPayment } from "../../billing/actions";

const MSG: Record<string, string> = { charge: "Charge added.", package: "Package sold and charged.", void: "Voided.", used: "One package session used." };

export async function BillingTab({ patientId, canWrite, canVoid, sp }: {
  patientId: string; canWrite: boolean; canVoid: boolean; sp: { saved?: string; paid?: string; error?: string };
}) {
  const ledger = await patientLedger(patientId);
  const paid = sp.paid ? ledger.payments.find((p) => p.id === sp.paid) : null;
  const today = todayManila();

  return (
    <div className="space-y-4">
      {paid && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Payment of {formatPhp(paid.amountPhp)} recorded ({paid.receiptNo}).{" "}
          <Link href={`/print/receipts/${paid.id}`} target="_blank" className="font-medium underline">Print acknowledgement receipt</Link>
        </p>
      )}
      {sp.saved && MSG[sp.saved] && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{MSG[sp.saved]}</p>}
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <section className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-6">
        <div className="col-span-2">
          <div className="muted">Balance due</div>
          <div className={`text-2xl font-semibold ${ledger.balance > 0 ? "text-red-700" : "text-emerald-700"}`}>{formatPhp(ledger.balance)}</div>
          {ledger.credit > 0 && <div className="text-emerald-700">Advance / credit: {formatPhp(ledger.credit)}</div>}
        </div>
        {AGING_BUCKETS.map((b) => (
          <div key={b}>
            <div className="muted">{b} days</div>
            <div className="font-medium">{formatPhp(ledger.aging.buckets[b])}</div>
          </div>
        ))}
      </section>

      {canWrite && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card text-sm">
            <h2 className="mb-2">Record payment</h2>
            <form action={recordPayment.bind(null, patientId)} className="grid grid-cols-2 gap-2">
              <label><span className="label">Amount (₱)</span><input className="input" name="amountPhp" type="number" min={1} step={1} required defaultValue={ledger.balance || undefined} /></label>
              <label><span className="label">Date</span><input className="input" name="date" type="date" defaultValue={today} required /></label>
              <label><span className="label">Method</span>
                <select className="input" name="method" defaultValue="CASH">
                  {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </label>
              <label><span className="label">Reference no. (GCash/Maya/card)</span><input className="input" name="reference" maxLength={60} /></label>
              <label><span className="label">Official receipt no. (if issued)</span><input className="input" name="orNumber" maxLength={40} /></label>
              <label><span className="label">Notes</span><input className="input" name="notes" maxLength={200} /></label>
              <button className="btn col-span-2">Save payment</button>
            </form>
            <p className="muted mt-2 text-xs">Partial payment okay. Applied automatically to the oldest unpaid charge.</p>
          </section>

          <div className="space-y-4">
            <section className="card text-sm">
              <h2 className="mb-2">Add charge</h2>
              <form action={addCharge.bind(null, patientId)} className="grid grid-cols-2 gap-2">
                <select className="input" name="category" defaultValue="CONSULTATION">
                  {CHARGE_CATEGORIES.filter((c) => c.key !== "PACKAGE").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <input className="input" name="date" type="date" defaultValue={today} required />
                <input className="input col-span-2" name="description" required maxLength={120} placeholder="Service (hal. Initial consultation). Walang diagnosis." />
                <input className="input" name="amountPhp" type="number" min={1} step={1} required placeholder="₱" />
                <button className="btn">Add charge</button>
              </form>
            </section>
            <section className="card text-sm">
              <h2 className="mb-2">Sell package (prepaid sessions)</h2>
              <form action={sellPackage.bind(null, patientId)} className="grid grid-cols-2 gap-2">
                <input className="input col-span-2" name="name" required maxLength={80} placeholder="Package name, hal. 10-session package" />
                <label><span className="label">Sessions</span><input className="input" name="sessionsTotal" type="number" min={1} max={100} required defaultValue={10} /></label>
                <label><span className="label">Price (₱)</span><input className="input" name="pricePhp" type="number" min={1} step={1} required /></label>
                <label><span className="label">Bought on</span><input className="input" name="purchasedOn" type="date" defaultValue={today} /></label>
                <label><span className="label">Expires (optional)</span><input className="input" name="expiresOn" type="date" /></label>
                <button className="btn col-span-2">Sell package</button>
              </form>
            </section>
          </div>
        </div>
      )}

      {ledger.packages.length > 0 && (
        <section className="card text-sm">
          <h2 className="mb-2">Packages</h2>
          <ul className="space-y-2">
            {ledger.packages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 p-2">
                <span>
                  <span className="font-medium">{p.name}</span> · {packageRemaining(p)} of {p.sessionsTotal} left · {formatPhp(p.pricePhp)}
                  {p.expiresOn ? ` · expires ${p.expiresOn}` : ""}
                  {p.cancelledAt ? " · cancelled" : ""}
                </span>
                {canWrite && packageActive(p, today) && (
                  <form action={usePackage.bind(null, p.id)}><button className="btn-secondary">Use 1 session today</button></form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card text-sm">
          <h2 className="mb-2">Charges</h2>
          <ul className="divide-y divide-slate-100">
            {ledger.charges.map((c) => {
              const due = ledger.outstanding[c.id] ?? 0;
              return (
                <li key={c.id} className={`py-2 ${c.voidedAt ? "opacity-50" : ""}`}>
                  <div className="flex justify-between gap-2">
                    <span>{c.date} · {c.description}</span>
                    <span className="font-medium">{formatPhp(c.amountPhp)}</span>
                  </div>
                  <div className="muted flex justify-between gap-2 text-xs">
                    <span>{categoryLabel(c.category)}</span>
                    <span>{c.voidedAt ? `Void: ${c.voidReason}` : due === 0 ? "Paid" : due < c.amountPhp ? `Partial, ${formatPhp(due)} due` : "Unpaid"}</span>
                  </div>
                  {canVoid && !c.voidedAt && (
                    <details className="mt-1">
                      <summary className="muted cursor-pointer text-xs">Void</summary>
                      <form action={voidCharge.bind(null, c.id)} className="mt-1 flex gap-2">
                        <input className="input" name="reason" required placeholder="Reason" />
                        <button className="btn-danger shrink-0">Void charge</button>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
            {ledger.charges.length === 0 && <li className="muted py-2">No charges yet.</li>}
          </ul>
        </section>

        <section className="card text-sm">
          <h2 className="mb-2">Payments</h2>
          <ul className="divide-y divide-slate-100">
            {ledger.payments.map((p) => (
              <li key={p.id} className={`py-2 ${p.voidedAt ? "opacity-50" : ""}`}>
                <div className="flex justify-between gap-2">
                  <span>{p.date} · {methodLabel(p.method)}{p.reference ? ` #${p.reference}` : ""}</span>
                  <span className="font-medium">{formatPhp(p.amountPhp)}</span>
                </div>
                <div className="muted flex justify-between gap-2 text-xs">
                  <span>{p.receiptNo}{p.orNumber ? ` · OR ${p.orNumber}` : ""}</span>
                  {p.voidedAt ? <span>Void: {p.voidReason}</span> : <Link href={`/print/receipts/${p.id}`} target="_blank" className="text-brand-700 underline">Receipt</Link>}
                </div>
                {canVoid && !p.voidedAt && (
                  <details className="mt-1">
                    <summary className="muted cursor-pointer text-xs">Void</summary>
                    <form action={voidPayment.bind(null, p.id)} className="mt-1 flex gap-2">
                      <input className="input" name="reason" required placeholder="Reason" />
                      <button className="btn-danger shrink-0">Void payment</button>
                    </form>
                  </details>
                )}
              </li>
            ))}
            {ledger.payments.length === 0 && <li className="muted py-2">No payments yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
