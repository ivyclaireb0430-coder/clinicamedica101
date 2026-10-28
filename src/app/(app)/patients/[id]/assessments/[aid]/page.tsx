import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { decrypt, decryptOptional } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { formatDateTime, manilaDateString } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { AssessmentForm } from "../../../AssessmentForm";
import { deleteAttachment, saveAssessment } from "../../../actions";

export default async function AssessmentPage({ params, searchParams }: { params: Promise<{ id: string; aid: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requirePermission("clinical:read");
  const { id, aid } = await params;
  const sp = await searchParams;
  const a = await db.assessment.findUnique({
    where: { id: aid },
    include: { attachments: { orderBy: { createdAt: "asc" } }, patient: { include: { lead: { include: { appointments: { orderBy: { startAt: "desc" }, take: 20 } } } } } },
  });
  if (!a || a.patientId !== id) notFound();
  await audit({ userId: user.id, action: "VIEW", entity: "Assessment", entityId: aid });
  const back = `/patients/${id}/assessments/${aid}`;

  return (
    <>
      <BackLink href={`/patients/${id}?tab=assessments`} label={`${a.patient.firstName} ${a.patient.lastName ?? ""}`} />
      <PageHeader title="Assessment" subtitle={`${a.patient.patientNo} · last updated ${formatDateTime(a.updatedAt)}`} />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      {sp.error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      {a.attachments.length > 0 && (
        <section className="card mb-4">
          <h2 className="mb-2">Files</h2>
          <ul className="space-y-1 text-sm">
            {a.attachments.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <a href={`/api/files/${f.id}`} target="_blank" className="truncate text-brand-700 underline">{decrypt(f.filenameEnc)}</a>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="muted text-xs">{Math.ceil(f.size / 1024)} KB</span>
                  <form action={deleteAttachment.bind(null, f.id, back)}>
                    <button className="text-xs text-red-600 hover:underline">Delete</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AssessmentForm
        action={saveAssessment.bind(null, id, aid)}
        date={manilaDateString(a.date)}
        appointmentId={a.appointmentId}
        appointments={(a.patient.lead?.appointments ?? []).map((x) => ({ id: x.id, label: formatDateTime(x.startAt) }))}
        values={{
          chiefComplaint: decryptOptional(a.chiefComplaintEnc),
          symptoms: decryptOptional(a.symptomsEnc),
          exam: decryptOptional(a.examEnc),
          investigations: decryptOptional(a.investigationsEnc),
          results: decryptOptional(a.resultsEnc),
          explained: decryptOptional(a.explainedEnc),
        }}
      />
    </>
  );
}
