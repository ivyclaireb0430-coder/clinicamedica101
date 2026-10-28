import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { LEAD_STAGES, isLeadStage, sourceLabel, stageLabel } from "@/lib/constants";
import { formatDate } from "@/lib/time";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string; view?: string }>;
}) {
  await requirePermission("leads:read");
  const { stage, q, view } = await searchParams;
  const board = view === "board";
  const search = q?.trim();

  const where = {
    ...(!board && isLeadStage(stage) ? { stage } : {}),
    ...(!board && !isLeadStage(stage) ? { stage: { not: "LOST" } } : {}),
    ...(search
      ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { mobile: { contains: search } }] }
      : {}),
  };

  const [leads, counts] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { lastContactAt: "desc" },
      take: 300,
      include: { campaign: { select: { name: true } } },
    }),
    db.lead.groupBy({ by: ["stage"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.stage === s)?._count ?? 0;

  const qs = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ q: search, ...params }).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Inquiries from Messenger, referrals, radio, and walk-ins"
        action={
          <div className="flex gap-2">
            <Link href="/leads/follow-up" className="btn-secondary">Needs follow-up</Link>
            <Link href="/leads/new" className="btn">+ New</Link>
          </div>
        }
      />

      <form className="mb-3 flex gap-2" action="/leads">
        <input className="input" name="q" placeholder="Search name or mobile" defaultValue={search} />
        {board && <input type="hidden" name="view" value="board" />}
        <button className="btn-secondary">Search</button>
      </form>

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <Link href={qs({ view: board ? undefined : "board" })} className="btn-secondary hidden shrink-0 md:inline-flex">
          {board ? "List view" : "Board view"}
        </Link>
        {!board && (
          <>
            <Link href={qs({})} className={`badge shrink-0 py-1 ${!isLeadStage(stage) ? "bg-brand-600 text-white" : ""}`}>
              Active
            </Link>
            {LEAD_STAGES.map((s) => (
              <Link key={s.key} href={qs({ stage: s.key })} className={`badge shrink-0 py-1 ${stage === s.key ? "bg-brand-600 text-white" : ""}`}>
                {s.label} · {countOf(s.key)}
              </Link>
            ))}
          </>
        )}
      </div>

      {board ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {LEAD_STAGES.map((s) => {
            const column = leads.filter((l) => l.stage === s.key);
            return (
              <div key={s.key} className="w-60 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
                  {s.label}
                  <span className="badge">{column.length}</span>
                </div>
                <div className="space-y-2">
                  {column.map((l) => (
                    <Link key={l.id} href={`/leads/${l.id}`} className="card block p-3 hover:border-brand-500">
                      <div className="font-medium">{l.firstName} {l.lastName}</div>
                      <div className="muted text-xs">{sourceLabel(l.source)} · {formatDate(l.lastContactAt)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState>Walang leads dito.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {leads.map((l) => (
            <li key={l.id}>
              <Link href={`/leads/${l.id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-brand-500">
                <div className="min-w-0">
                  <div className="truncate font-medium">{l.firstName} {l.lastName}</div>
                  <div className="muted truncate text-xs">
                    {sourceLabel(l.source)}
                    {l.campaign ? ` · ${l.campaign.name}` : ""} · last contact {formatDate(l.lastContactAt)}
                  </div>
                </div>
                <StatusBadge status={l.stage} label={stageLabel(l.stage)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
