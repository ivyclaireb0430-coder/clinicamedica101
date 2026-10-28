import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { allocateFifo, methodLabel, pesosInWords } from "@/lib/billing";
import { formatDate, formatPhp, manilaToUtc } from "@/lib/time";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Acknowledgement receipt · Clinica Medica 101" };

export default async function PrintReceipt({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing:read");
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { id }, include: { patient: true } });
  if (!payment) notFound();
  await audit({ userId: user.id, action: "EXPORT", entity: "Payment", entityId: id, detail: "receipt" });

  const [header, clinicName, clinicAddress, receiver, charges, payments] = await Promise.all([
    getSetting("receiptHeader"), getSetting("clinicName"), getSetting("clinicAddress"),
    db.user.findUnique({ where: { id: payment.receivedById }, select: { name: true } }),
    db.charge.findMany({ where: { patientId: payment.patientId, voidedAt: null } }),
    db.payment.findMany({ where: { patientId: payment.patientId, voidedAt: null } }),
  ]);
  const all = allocateFifo(charges, payments);
  const appliedTo = all.allocations
    .filter((a) => a.paymentId === id)
    .map((a) => ({ ...a, charge: charges.find((c) => c.id === a.chargeId)! }));
  const headerLines = (header || `${clinicName}\n${clinicAddress}`).split("\n").filter(Boolean);

  return (
    <main className="mx-auto max-w-xl bg-white p-8 text-sm text-slate-900 print:p-0">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
        <div>
          <div className="text-base font-semibold text-brand-700">{headerLines[0]}</div>
          {headerLines.slice(1).map((l) => <div key={l} className="text-slate-600">{l}</div>)}
        </div>
        <PrintButton label="Print" />
      </div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-lg tracking-wide">ACKNOWLEDGEMENT RECEIPT</h1>
        <div className="text-right">
          <div className="font-mono font-semibold">{payment.receiptNo}</div>
          <div className="text-slate-600">{formatDate(manilaToUtc(payment.date, "12:00"))}</div>
        </div>
      </div>
      {payment.voidedAt && <p className="mb-3 rounded border-2 border-red-600 p-2 text-center font-bold text-red-700">VOID: {payment.voidReason}</p>}

      <p className="mb-3 leading-relaxed">
        Received from <b>{payment.patient.firstName} {payment.patient.lastName}</b> ({payment.patient.patientNo}) the amount of{" "}
        <b>{pesosInWords(payment.amountPhp)}</b> (<b>{formatPhp(payment.amountPhp)}</b>).
      </p>
      <table className="mb-4 w-full">
        <tbody>
          <tr><td className="py-0.5 text-slate-600">Payment method</td><td>{methodLabel(payment.method)}</td></tr>
          {payment.reference && <tr><td className="py-0.5 text-slate-600">Reference no.</td><td className="font-mono">{payment.reference}</td></tr>}
          {payment.orNumber && <tr><td className="py-0.5 text-slate-600">Official receipt no.</td><td className="font-mono">{payment.orNumber}</td></tr>}
        </tbody>
      </table>

      <h2 className="mb-1 text-sm font-semibold">Applied to</h2>
      <table className="mb-4 w-full border-collapse">
        <tbody>
          {appliedTo.map((a) => (
            <tr key={a.chargeId} className="border-t border-slate-200">
              <td className="py-1">{a.charge.date} · {a.charge.description}</td>
              <td className="py-1 text-right">{formatPhp(a.amountPhp)}</td>
            </tr>
          ))}
          {appliedTo.length < 1 && <tr className="border-t border-slate-200"><td className="py-1" colSpan={2}>Advance payment (credit for future services)</td></tr>}
        </tbody>
      </table>
      <p className="mb-8 text-slate-600">Remaining balance as of today: <b>{formatPhp(all.balance)}</b>{all.credit > 0 ? ` · Credit: ${formatPhp(all.credit)}` : ""}</p>

      <div className="flex justify-end">
        <div className="w-56 border-t border-slate-400 pt-1 text-center">
          <div>{receiver?.name ?? ""}</div>
          <div className="text-xs text-slate-600">Received by</div>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">This is an acknowledgement receipt, not an official receipt.</p>
    </main>
  );
}
