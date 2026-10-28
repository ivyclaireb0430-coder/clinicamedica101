import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { decryptOptional } from "@/lib/crypto";
import { BackLink, PageHeader } from "@/components/ui";
import { LeadForm } from "../../LeadForm";
import { updateLead } from "../../actions";

export default async function EditLead({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("leads:write");
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) notFound();
  const showConcern = can(user.role, "lead_concern:read");
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  return (
    <>
      <BackLink href={`/leads/${id}`} label="Back" />
      <PageHeader title={`Edit ${lead.firstName}`} />
      <LeadForm
        action={updateLead.bind(null, id)}
        campaigns={campaigns}
        showConcern={showConcern}
        values={{ ...lead, concern: showConcern ? decryptOptional(lead.concernEnc) : null }}
        submitLabel="Save changes"
      />
    </>
  );
}
