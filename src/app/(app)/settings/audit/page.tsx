import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { addDays, formatDateTime, manilaToUtc, todayManila } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";

const PAGE = 100;
const ACTIONS = ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "SEND", "VOID", "LOGIN", "LOGIN_FAILED", "CONNECT"];
const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

export default async function AuditPage({ searchParams }: {
  searchParams: Promise<{ user?: string; action?: string; entity?: string; from?: string; to?: string; record?: string; page?: string }>;
}) {
  await requirePermission("audit:read");
  const sp = await searchParams;
  const from = isDate(sp.from) ? sp.from! : addDays(todayManila(), -7);
  const to = isDate(sp.to) ? sp.to! : todayManila();
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    createdAt: { gte: manilaToUtc(from, "00:00"), lt: manilaToUtc(addDays(to, 1), "00:00") },
    ...(sp.user ? { userId: sp.user === "system" ? null : sp.user } : {}),
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.record ? { entityId: sp.record } : {}),
  };
  const [rows, total, users, entities] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  const qs = (extra: Record<string, string | number>) =>
    "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), from, to, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });

  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader
        title="Audit log"
        subtitle="Who viewed or changed what. Required under the Data Privacy Act."
        action={<a href={`/api/export/audit?from=${from}&to=${to}`} className="btn-secondary">Export CSV</a>}
      />
      <form className="card mb-4 grid gap-2 text-sm sm:grid-cols-6">
        <input className="input" type="date" name="from" defaultValue={from} aria-label="From" />
        <input className="input" type="date" name="to" defaultValue={to} aria-label="To" />
        <select className="input" name="user" defaultValue={sp.user ?? ""} aria-label="User">
          <option value="">All users</option>
          <option value="system">System / patient</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input" name="action" defaultValue={sp.action ?? ""} aria-label="Action">
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="input" name="entity" defaultValue={sp.entity ?? ""} aria-label="Record type">
          <option value="">All records</option>
          {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
        </select>
        <button className="btn">Filter</button>
      </form>
      <p className="muted mb-2 text-sm">{total.toLocaleString("en-PH")} entries{sp.record ? ` for record ${sp.record}` : ""}</p>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr><th className="py-1">When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap py-1 pr-2">{formatDateTime(r.createdAt)}</td>
                <td className="pr-2">{r.user?.name ?? <span className="muted">System / patient</span>}</td>
                <td className="pr-2"><span className={`badge ${r.action === "LOGIN_FAILED" || r.action === "VOID" || r.action === "DELETE" ? "bg-red-100 text-red-700" : r.action === "EXPORT" ? "bg-amber-100 text-amber-800" : ""}`}>{r.action}</span></td>
                <td className="pr-2">
                  {r.entity}
                  {r.entityId && <Link href={qs({ record: r.entityId, page: 1 })} className="muted block font-mono text-xs hover:underline">{r.entityId.slice(-8)}</Link>}
                </td>
                <td className="text-slate-600">{r.detail}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted py-2">No entries.</td></tr>}
          </tbody>
        </table>
      </section>
      <div className="mt-3 flex gap-2">
        {page > 1 && <Link href={qs({ page: page - 1 })} className="btn-secondary">← Newer</Link>}
        {page * PAGE < total && <Link href={qs({ page: page + 1 })} className="btn-secondary">Older →</Link>}
      </div>
    </>
  );
}
