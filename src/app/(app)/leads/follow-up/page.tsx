import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { daysSince, needsFollowUp } from "@/lib/pipeline";
import { getNumberSetting } from "@/lib/settings";
import { sourceLabel, stageLabel } from "@/lib/constants";
import { BackLink, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { markContacted } from "../actions";

export default async function FollowUpQueue() {
  await requirePermission("leads:read");
  const days = await getNumberSetting("followUpDays");
  const candidates = await db.lead.findMany({
    where: { stage: { in: ["NEW", "REPLIED", "FEE_EXPLAINED"] } },
    orderBy: { lastContactAt: "asc" },
  });
  const now = new Date();
  const due = candidates.filter((l) => needsFollowUp(l, days, now));

  return (
    <>
      <BackLink href="/leads" label="Leads" />
      <PageHeader
        title="Needs follow-up"
        subtitle={`Inquiries with no booking and no contact for ${days}+ days. Use the "Follow-up nudge" or "Price objection" script.`}
      />
      {due.length === 0 ? (
        <EmptyState>Wala nang kailangang i-follow up ngayon. 🎉</EmptyState>
      ) : (
        <ul className="space-y-2">
          {due.map((l) => (
            <li key={l.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <Link href={`/leads/${l.id}`} className="min-w-0">
                <div className="font-medium">{l.firstName} {l.lastName}</div>
                <div className="muted text-xs">
                  {sourceLabel(l.source)} · {daysSince(l.lastContactAt, now)} days since last contact
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <StatusBadge status={l.stage} label={stageLabel(l.stage)} />
                <form action={markContacted.bind(null, l.id)}>
                  <button className="btn-secondary py-1 text-xs">Mark contacted</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
