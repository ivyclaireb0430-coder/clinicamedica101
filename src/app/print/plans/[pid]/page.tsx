import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { decryptOptional } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { planTotal } from "@/lib/clinical";
import { getSetting } from "@/lib/settings";
import { formatDate, formatPhp } from "@/lib/time";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Treatment plan · Clinica Medica 101" };

// Patient copy: plan, schedule, cost estimate, benefits/risks/alternatives. No assessment notes.
export default async function PrintPlan({ params }: { params: Promise<{ pid: string }> }) {
  const user = await requirePermission("clinical:read");
  const { pid } = await params;
  const plan = await db.treatmentPlan.findUnique({
    where: { id: pid },
    include: { patient: true, items: { orderBy: { sortOrder: "asc" } }, consent: true },
  });
  if (!plan) notFound();
  await audit({ userId: user.id, action: "EXPORT", entity: "TreatmentPlan", entityId: pid, detail: "print" });
  const [clinicName, clinicAddress] = await Promise.all([getSetting("clinicName"), getSetting("clinicAddress")]);
  const sections = [
    ["Goals of treatment", plan.goalsEnc],
    ["Schedule", plan.scheduleEnc],
    ["Potential benefits", plan.benefitsEnc],
    ["Risks and possible side effects", plan.risksEnc],
    ["Alternatives discussed", plan.alternativesEnc],
  ] as const;

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-sm text-slate-900 print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <div className="text-lg font-semibold text-brand-700">{clinicName}</div>
          <div className="text-slate-600">{clinicAddress}</div>
        </div>
        <PrintButton />
      </div>
      <h1 className="mb-1 text-xl">Treatment plan &amp; cost estimate</h1>
      <p className="mb-4 text-slate-600">
        {plan.patient.firstName} {plan.patient.lastName} · {plan.patient.patientNo} · Prepared {formatDate(plan.updatedAt)}
      </p>

      <table className="mb-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="py-1">Modality</th><th className="py-1 text-right">Sessions</th><th className="py-1 text-right">Price / session</th><th className="py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {plan.items.map((i) => (
            <tr key={i.id} className="border-b border-slate-100">
              <td className="py-1">{i.modality}{i.notes ? <div className="text-xs text-slate-500">{i.notes}</div> : null}</td>
              <td className="py-1 text-right">{i.sessions}</td>
              <td className="py-1 text-right">{formatPhp(i.unitPricePhp)}</td>
              <td className="py-1 text-right">{formatPhp(i.sessions * i.unitPricePhp)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2" colSpan={3}>Estimated total</td>
            <td className="py-2 text-right">{formatPhp(planTotal(plan.items))}</td>
          </tr>
        </tbody>
      </table>
      <p className="mb-4 text-xs text-slate-500">
        This is an estimate. The plan may be adjusted after reassessment; any change in cost will be discussed with you first.
        Payment per session or as a package.
      </p>

      {sections.map(([label, v]) => {
        const text = decryptOptional(v);
        return text ? (
          <section key={label} className="mb-3">
            <h2 className="text-sm font-semibold">{label}</h2>
            <p className="whitespace-pre-wrap">{text}</p>
          </section>
        ) : null;
      })}

      <p className="mt-4 text-xs text-slate-500">
        Results vary from person to person and are not guaranteed. You may ask questions, take time to decide, or decline
        at any time.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-8 text-xs">
        <div className="border-t border-slate-400 pt-1">Patient signature over printed name / date</div>
        <div className="border-t border-slate-400 pt-1">Physician signature / date</div>
      </div>
    </main>
  );
}
