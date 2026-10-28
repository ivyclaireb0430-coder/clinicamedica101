import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { BackLink, PageHeader } from "@/components/ui";
import { PlanForm } from "../../../PlanForm";
import { savePlan } from "../../../actions";

export default async function NewPlan({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("clinical:write");
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) notFound();
  return (
    <>
      <BackLink href={`/patients/${id}?tab=plans`} label={`${patient.firstName} ${patient.lastName ?? ""}`} />
      <PageHeader title="New treatment plan" subtitle={patient.patientNo} />
      <PlanForm action={savePlan.bind(null, id, null)} />
    </>
  );
}
