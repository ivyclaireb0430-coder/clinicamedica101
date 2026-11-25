import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { getSetting } from "@/lib/settings";
import { CONSULT_STATUS_LABELS } from "@/lib/consult/store";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Prisma } from "@prisma/client";

const TABS = [
  { key: "review", label: "Para kay Doc", where: { status: "SUBMITTED" } },
  { key: "emergency", label: "Emergency", where: { status: "EMERGENCY", closedAt: null } },
  { key: "active", label: "Kausap pa ang AI", where: { status: "ACTIVE" } },
  { key: "done", label: "Tapos na", where: { status: { in: ["SENT", "CLOSED"] } } },
] satisfies { key: string; label: string; where: Prisma.ConsultSessionWhereInput }[];

const TONE: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-amber-800",
  EMERGENCY: "bg-red-100 text-red-800",
  ACTIVE: "bg-sky-100 text-sky-800",
  SENT: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-700",
};

export default async function ConsultsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("consult:review");
  const { tab: tabKey } = await searchParams;
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0];
  const [sessions, counts, enabled] = await Promise.all([
    db.consultSession.findMany({ where: tab.where, orderBy: { lastMessageAt: "desc" }, take: 200 }),
    Promise.all(TABS.map((t) => db.consultSession.count({ where: t.where }))),
    getSetting("consultEnabled"),
  ]);

  return (
    <>
      <PageHeader
        title="Online konsulta"
        subtitle={enabled === "1" ? "Bukas sa mga pasyente" : "Sarado pa sa mga pasyente (Settings → Online konsulta)"}
        action={
          <div className="flex gap-2">
            <Link href="/consults/train" className="btn-secondary">Turuan si Doc AI</Link>
            <Link href="/settings/konsulta" className="btn-secondary">Settings</Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t, i) => (
          <Link key={t.key} href={`/consults?tab=${t.key}`} className={t.key === tab.key ? "btn" : "btn-secondary"}>
            {t.label} · {counts[i]}
          </Link>
        ))}
      </div>
      {sessions.length === 0 ? (
        <EmptyState>{tab.key === "review" ? "Walang naghihintay ng review ni Doc. 🎉" : "Wala pa rito."}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/consults/${s.id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-brand-500">
                <div className="min-w-0">
                  <div className="font-medium">{s.firstName} {s.lastName}</div>
                  <div className="muted text-xs">
                    {formatDateTime(s.submittedAt ?? s.lastMessageAt)} · {s.channel === "MESSENGER" ? "galing Messenger" : "website"}
                  </div>
                </div>
                <span className={`badge ${TONE[s.status] ?? ""}`}>{CONSULT_STATUS_LABELS[s.status] ?? s.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
