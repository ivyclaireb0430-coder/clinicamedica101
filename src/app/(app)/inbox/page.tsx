import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { stageLabel } from "@/lib/constants";
import { getSetting } from "@/lib/settings";
import { messengerConfigured } from "@/lib/messenger/meta";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("lead_concern:read");
  const { tab } = await searchParams;
  const doctorTab = tab !== "all";
  const [conversations, needsCount, automation] = await Promise.all([
    db.conversation.findMany({
      where: doctorTab ? { needsDoctor: true } : {},
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      include: { lead: { select: { firstName: true, lastName: true, stage: true } } },
    }),
    db.conversation.count({ where: { needsDoctor: true } }),
    getSetting("automationEnabled"),
  ]);

  return (
    <>
      <PageHeader title="Messenger inbox" subtitle={automation === "1" ? "Auto-replies are ON" : "Auto-replies are OFF (Settings → Messenger)"} />
      {!messengerConfigured() && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Hindi pa naka-connect ang Facebook Page. Demo conversations lang ang makikita hanggang ma-setup ang Meta app.
        </p>
      )}
      <div className="mb-4 flex gap-2">
        <Link href="/inbox" className={doctorTab ? "btn" : "btn-secondary"}>Needs doctor reply · {needsCount}</Link>
        <Link href="/inbox?tab=all" className={doctorTab ? "btn-secondary" : "btn"}>All</Link>
      </div>
      {conversations.length === 0 ? (
        <EmptyState>{doctorTab ? "Walang naghihintay ng sagot ng doktor. 🎉" : "Wala pang conversations."}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/inbox/${c.id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-brand-500">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {c.lead.firstName} {c.lead.lastName}
                    {c.unread > 0 && <span className="badge bg-brand-600 text-white">{c.unread}</span>}
                  </div>
                  <div className="muted text-xs">
                    {formatDateTime(c.lastMessageAt)}
                    {c.automationPaused ? " · bot paused" : ""}
                    {c.needsDoctor ? " · needs doctor" : ""}
                  </div>
                </div>
                <StatusBadge status={c.lead.stage} label={stageLabel(c.lead.stage)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
