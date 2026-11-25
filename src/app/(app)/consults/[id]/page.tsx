import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { decrypt, decryptOptional } from "@/lib/crypto";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { formatDateTime, todayManila } from "@/lib/time";
import { ageFromBirthDate } from "@/lib/consult/ai";
import { CONSULT_STATUS_LABELS, consultDoctorName, readPrescription, readSummary } from "@/lib/consult/store";
import { BackLink, PageHeader } from "@/components/ui";
import { askPatient, closeConsult } from "../actions";
import { DoctorReplyForm } from "./DoctorReplyForm";

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="list-disc pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function Field({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export default async function ConsultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("consult:review");
  const { id } = await params;
  const s = await db.consultSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } }, files: { orderBy: { createdAt: "asc" } } },
  });
  if (!s) notFound();
  await audit({ userId: user.id, action: "VIEW", entity: "ConsultSession", entityId: id });
  const doctor = await consultDoctorName();
  const summary = readSummary(s);
  const rx = readPrescription(s);
  const age = ageFromBirthDate(s.birthDate, todayManila());
  const draft = decryptOptional(s.draftNoteEnc);
  const sentNote = decryptOptional(s.doctorNoteEnc);
  const canReply = s.status === "SUBMITTED" || s.status === "EMERGENCY";

  return (
    <>
      <BackLink href="/consults" label="Online konsulta" />
      <PageHeader
        title={`${s.firstName} ${s.lastName ?? ""}`.trim()}
        subtitle={`${age ?? "?"} y/o · ${s.sex?.toLowerCase() ?? "?"} · ${CONSULT_STATUS_LABELS[s.status] ?? s.status}`}
        action={
          <div className="flex gap-2">
            {s.leadId && <Link className="btn-secondary" href={`/leads/${s.leadId}`}>Lead</Link>}
            {s.patientId && <Link className="btn-secondary" href={`/patients/${s.patientId}`}>Patient record</Link>}
          </div>
        }
      />

      {s.status === "EMERGENCY" && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ⚠️ Posibleng emergency ({s.emergencyAt ? formatDateTime(s.emergencyAt) : ""}). Sinabihan na ang pasyente na pumunta sa ER o tumawag sa 911, at tumigil
          na ang AI. Tawagan ang pasyente kung kailangan: <a className="underline" href={`tel:${s.mobile}`}>{s.mobile}</a>.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="card space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">AI summary para kay Doc</h2>
              <span className="badge bg-violet-100 text-violet-800">AI draft, i-verify</span>
            </div>
            {!summary ? (
              <p className="muted">Walang AI summary (hindi pa naipapadala, o hindi sumagot ang AI). Basahin ang buong usapan.</p>
            ) : (
              <>
                <Field title="Chief complaint" text={summary.chiefComplaint} />
                <Field title="History of present illness" text={summary.historyOfPresentIllness} />
                <List title="Pertinent positives" items={summary.pertinentPositives} />
                <List title="Pertinent negatives" items={summary.pertinentNegatives} />
                <Field title="Past history" text={summary.pastHistory} />
                <Field title="Medications & supplements" text={summary.medicationsAndSupplements} />
                <Field title="Allergies" text={summary.allergies} />
                <Field title="Family & social" text={summary.familyAndSocial} />
                {summary.redFlags.length > 0 && (
                  <div className="rounded-lg bg-red-50 p-2 text-red-900"><List title="⚠️ Red flags" items={summary.redFlags} /></div>
                )}
                <div className="rounded-lg bg-violet-50 p-2">
                  <List title="Possible assessments (suggestion lang)" items={summary.possibleAssessments} />
                  <Field title="Suggested plan (suggestion lang)" text={summary.suggestedPlan} />
                </div>
                <List title="Puwede pang itanong" items={summary.questionsToClarify} />
                {summary.recommendInPerson && <p className="rounded bg-amber-50 p-2 text-amber-900">AI suggestion: kailangan ng in-clinic visit bago mag-treatment.</p>}
              </>
            )}
          </section>

          {s.files.length > 0 && (
            <section className="card text-sm">
              <h2 className="mb-2 font-semibold">Files mula sa pasyente</h2>
              <ul className="space-y-1">
                {s.files.map((f) => (
                  <li key={f.id}>
                    <a className="text-brand-700 underline" href={`/api/consult-files/${f.id}`} target="_blank">📎 {decrypt(f.filenameEnc)}</a>
                    <span className="muted"> · {Math.round(f.size / 1024)} KB</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card text-sm">
            <h2 className="mb-2 font-semibold">Buong usapan</h2>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {s.messages.map((m) => (
                <div key={m.id} className={m.sender === "PATIENT" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                      m.sender === "PATIENT" ? "bg-sky-100" : m.sender === "SYSTEM" ? "bg-red-50 text-red-900" : m.sender === "DOCTOR" ? "bg-emerald-100" : "bg-slate-100"
                    }`}
                  >
                    <p className="text-[11px] text-slate-500">
                      {m.sender === "PATIENT" ? "Pasyente" : m.sender === "SYSTEM" ? "Emergency notice" : m.sender === "DOCTOR" ? doctor : "AI assistant"} · {formatDateTime(m.createdAt)}
                    </p>
                    {decrypt(m.textEnc)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {canReply ? (
            <section className="card space-y-3 text-sm">
              <h2 className="font-semibold">Sagot ni {doctor}</h2>
              <p className="muted">
                Ito lang ang makikita ng pasyente, pagkatapos ninyong pindutin ang <b>Approve &amp; ipadala</b>. Ang AI summary sa kaliwa ay para sa inyo lang.
              </p>
              <DoctorReplyForm id={s.id} draft={draft ?? ""} />
            </section>
          ) : s.status === "SENT" ? (
            <section className="card space-y-2 text-sm">
              <h2 className="font-semibold">Naipadala ({s.sentAt ? formatDateTime(s.sentAt) : ""})</h2>
              <p className="whitespace-pre-wrap">{sentNote}</p>
              {rx.length > 0 && (
                <>
                  <ol className="list-decimal pl-5">{rx.map((r, i) => <li key={i}><b>{r.drug}</b> {r.form} {r.qty && `#${r.qty}`} · Sig: {r.sig}</li>)}</ol>
                  <Link className="btn-secondary" href={`/consults/${s.id}/reseta`}>Tingnan ang e-Reseta</Link>
                </>
              )}
              {draft && sentNote && draft.trim() !== sentNote.trim() && can(user.role, "consult:train") && (
                <Link className="btn-secondary w-full" href={`/consults/train?from=${s.id}`}>🎓 Turuan ang AI mula sa edit ko</Link>
              )}
            </section>
          ) : s.status === "ACTIVE" ? (
            <section className="card text-sm">Kausap pa ng pasyente ang AI. Lalabas ito sa &quot;Para kay Doc&quot; kapag pinindot niya ang &quot;Ipadala kay Doc&quot;.</section>
          ) : null}

          {s.status === "SUBMITTED" && (
            <form action={askPatient.bind(null, s.id)} className="card space-y-2 text-sm">
              <h2 className="font-semibold">Kulang pa ang impormasyon?</h2>
              <p className="muted">Ipapadala ang tanong ninyo sa pasyente, at itutuloy ng AI ang pagtatanong. Babalik ito rito kapag ipinadala ulit ng pasyente.</p>
              <textarea className="input" name="question" rows={2} required maxLength={2000} placeholder="Hal. Ilang araw na po ang lagnat, at gaano kataas?" />
              <button className="btn-secondary">Itanong sa pasyente</button>
            </form>
          )}

          {s.status !== "CLOSED" && s.status !== "SENT" && (
            <form action={closeConsult.bind(null, s.id)} className="card space-y-2 text-sm">
              <h2 className="font-semibold">Isara nang walang sagot</h2>
              <p className="muted">Hal. na-handle na sa telepono o sa ER, o duplicate. Walang ipapadala sa pasyente.</p>
              <input className="input" name="reason" maxLength={200} placeholder="Dahilan (optional)" />
              <button className="btn-secondary">Isara</button>
            </form>
          )}

          <section className="card text-xs text-slate-500">
            Consent: {s.consentVersion} · {formatDateTime(s.consentAt)} · Mobile {s.mobile}{s.email ? ` · ${s.email}` : ""}
          </section>
        </div>
      </div>
    </>
  );
}
