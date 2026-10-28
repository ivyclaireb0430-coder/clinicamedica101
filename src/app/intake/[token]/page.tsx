import Link from "next/link";
import { db } from "@/lib/db";
import { submitIntake } from "./actions";

export const metadata = { title: "Pre-consult form · Clinica Medica 101", robots: { index: false } };

function Field({ name, label, hint, rows = 3, required }: { name: string; label: string; hint?: string; rows?: number; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required ? " *" : ""}</label>
      {hint && <p className="muted mb-1 text-xs">{hint}</p>}
      <textarea className="input" id={name} name={name} rows={rows} required={required} maxLength={4000} />
    </div>
  );
}

export default async function IntakePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { token } = await params;
  const { done, error } = await searchParams;
  const form = await db.intakeForm.findUnique({ where: { token }, include: { lead: { select: { firstName: true, lastName: true, mobile: true, email: true } } } });

  if (done) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card space-y-2 text-center">
          <h1>Salamat po! ✅</h1>
          <p className="text-sm">Natanggap na ng doktor ang inyong form. Makikita niya ito bago ang inyong consultation.</p>
        </div>
      </main>
    );
  }
  if (!form || form.status !== "SENT" || form.expiresAt < new Date()) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card space-y-2 text-center">
          <h1>Hindi na magagamit ang link na ito</h1>
          <p className="text-sm">Maaaring na-submit na o expired na. Mag-message lang po sa amin sa Facebook para sa bagong link.</p>
        </div>
      </main>
    );
  }

  const lead = form.lead;
  return (
    <main className="mx-auto max-w-2xl p-4 pb-16">
      <div className="mb-4">
        <h1>Pre-consult form</h1>
        <p className="muted">Clinica Medica 101 · Centuria Medical Makati</p>
        <p className="mt-2 text-sm">
          Para mas magamit ang oras ng inyong consultation, paki-sagot po ito bago kayo pumunta. Mga 10 minuto lang po.
          Ang inyong sagot ay makikita lang ng doktor.
        </p>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Paki-check po: {error}</p>}

      <form action={submitIntake.bind(null, token)} className="space-y-4">
        <section className="card grid gap-3 sm:grid-cols-2">
          <h2 className="sm:col-span-2">Tungkol sa inyo</h2>
          <div>
            <label className="label" htmlFor="firstName">First name *</label>
            <input className="input" id="firstName" name="firstName" defaultValue={lead?.firstName === "Messenger user" ? "" : lead?.firstName} required />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Last name *</label>
            <input className="input" id="lastName" name="lastName" defaultValue={lead?.lastName ?? ""} required />
          </div>
          <div>
            <label className="label" htmlFor="birthDate">Birthday *</label>
            <input className="input" id="birthDate" name="birthDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="sex">Sex *</label>
            <select className="input" id="sex" name="sex" required defaultValue="">
              <option value="" disabled>Pumili…</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
              <option value="UNDISCLOSED">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mobile">Mobile *</label>
            <input className="input" id="mobile" name="mobile" type="tel" defaultValue={lead?.mobile ?? ""} required />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">Address (city)</label>
            <input className="input" id="address" name="address" />
          </div>
          <div>
            <label className="label" htmlFor="occupation">Occupation</label>
            <input className="input" id="occupation" name="occupation" />
          </div>
          <div>
            <label className="label" htmlFor="emergencyContact">Emergency contact (name & number)</label>
            <input className="input" id="emergencyContact" name="emergencyContact" />
          </div>
        </section>

        <section className="card space-y-3">
          <h2>Inyong kalusugan</h2>
          <Field name="chiefComplaint" label="Ano ang pangunahing concern ninyo?" hint="Kailan nagsimula, gaano kadalas, ano ang nagpapalala o nagpapagaan" rows={4} required />
          <Field name="history" label="Medical history" hint="Mga sakit noon, operasyon, pagka-ospital" />
          <Field name="familyHistory" label="Family history" hint="Hal. diabetes, high blood, cancer sa pamilya" rows={2} />
          <Field name="medications" label="Mga gamot at supplements na iniinom ngayon" hint="Pangalan at dosage kung alam" />
          <Field name="allergies" label="Allergies" hint="Gamot, pagkain, iba pa. Isulat ang 'Wala' kung wala." rows={2} />
          <Field name="lifestyle" label="Lifestyle" hint="Pagkain, tulog, exercise, paninigarilyo, alak, stress" />
          <Field name="priorTreatments" label="Mga treatment na nasubukan na" hint="Ano ang nakatulong at hindi" />
          <Field name="goals" label="Ano ang gusto ninyong makuha o maintindihan sa consultation?" rows={2} />
        </section>

        <section className="card space-y-2 text-sm">
          <h2>Data privacy consent</h2>
          <p>
            Pinapayagan ko ang Clinica Medica 101 na kolektahin at gamitin ang aking personal at health information para sa
            aking consultation at treatment, ayon sa <Link href="/privacy" className="text-brand-700 underline" target="_blank">Privacy Notice</Link> at
            sa Data Privacy Act of 2012. Alam kong puwede kong bawiin ang consent na ito anumang oras.
          </p>
          <label className="flex items-start gap-2 font-medium">
            <input type="checkbox" name="consent" className="mt-1" required /> Sang-ayon ako
          </label>
        </section>

        <button className="btn w-full">Submit form</button>
      </form>
    </main>
  );
}
