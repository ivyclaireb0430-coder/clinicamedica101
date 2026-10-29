import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import { formatDateTime, todayManila } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { AssessmentForm } from "../../../AssessmentForm";
import { saveAssessment } from "../../../actions";

export default async function NewAssessment({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ appointmentId?: string }> }) {
  await requirePermission("clinical:write");
  const { id } = await params;
  const { appointmentId } = await searchParams;
  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      lead: { include: { appointments: { orderBy: { startAt: "desc" }, take: 20 } } },
      intakeForms: { where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });
  if (!patient) notFound();
  // Pre-fill the chief complaint from the latest pre-consult form.
  const intake = decryptJson<{ chiefComplaint?: string }>(patient.intakeForms[0]?.answersEnc);
  return (
    <>
      <BackLink href={`/patients/${id}?tab=assessments`} label={`${patient.firstName} ${patient.lastName ?? ""}`} />
      <PageHeader title="New assessment" subtitle={patient.patientNo} />
      <AssessmentForm
        action={saveAssessment.bind(null, id, null)}
        values={{ chiefComplaint: intake?.chiefComplaint }}
        date={todayManila()}
        appointmentId={appointmentId}
        appointments={(patient.lead?.appointments ?? []).map((a) => ({ id: a.id, label: formatDateTime(a.startAt) }))}
      />
    </>
  );
}
