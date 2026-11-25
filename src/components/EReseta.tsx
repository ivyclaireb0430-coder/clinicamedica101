import type { RxLine } from "@/lib/consult/store";

export type ResetaProps = {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  doctorName: string;
  licenseNo: string;
  ptrNo: string;
  s2No: string;
  patientName: string;
  age: number | null;
  sex: string | null;
  date: string;
  lines: RxLine[];
  reference: string;
};

/** Printable e-prescription. Generic names first (Generics Act, RA 6675); never dangerous drugs (online konsulta). */
export function EReseta(p: ResetaProps) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-300 bg-white p-6 text-slate-900 print:border-0 print:p-0">
      <div className="border-b-2 border-brand-700 pb-2 text-center">
        <p className="text-lg font-bold">{p.doctorName}</p>
        <p className="text-sm">{p.clinicName}</p>
        <p className="text-xs text-slate-600">{p.clinicAddress}{p.clinicPhone ? ` · ${p.clinicPhone}` : ""}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p className="col-span-2"><span className="text-slate-500">Patient:</span> <b>{p.patientName}</b></p>
        <p><span className="text-slate-500">Age/Sex:</span> {p.age ?? "—"} / {p.sex ? p.sex.charAt(0) + p.sex.slice(1).toLowerCase() : "—"}</p>
        <p><span className="text-slate-500">Date:</span> {p.date}</p>
      </div>
      <p className="mt-4 font-serif text-4xl font-bold text-brand-700">℞</p>
      <ol className="mt-2 list-decimal space-y-3 pl-6 text-sm">
        {p.lines.map((r, i) => (
          <li key={i}>
            <p><b>{r.drug}</b> {r.form}{r.qty ? <span className="ml-2">#{r.qty}</span> : null}</p>
            <p>Sig: {r.sig}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex justify-end">
        <div className="w-64 text-center text-sm">
          <p className="font-semibold">{p.doctorName}</p>
          <div className="border-t border-slate-400 pt-1 text-xs">
            <p>PRC License No. {p.licenseNo || "________"}</p>
            <p>PTR No. {p.ptrNo || "________"}</p>
            {p.s2No && <p>S2 No. {p.s2No}</p>}
          </div>
        </div>
      </div>
      <p className="mt-6 text-[11px] text-slate-500">
        Electronic prescription from an online konsulta, reviewed and issued by the physician above. Ref. {p.reference}. Valid only for the patient named.
        Verify with the clinic{p.clinicPhone ? ` at ${p.clinicPhone}` : ""}.
      </p>
    </div>
  );
}
