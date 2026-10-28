import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { BackLink, PageHeader } from "@/components/ui";
import { LeadForm } from "../LeadForm";
import { createLead } from "../actions";

export default async function NewLead() {
  const user = await requirePermission("leads:write");
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  return (
    <>
      <BackLink href="/leads" label="Leads" />
      <PageHeader title="New inquiry" subtitle="Para sa walk-in, tawag, o referral. Messenger leads are created automatically (Phase 2)." />
      <LeadForm action={createLead} campaigns={campaigns} showConcern={can(user.role, "lead_concern:read")} submitLabel="Save inquiry" />
    </>
  );
}
