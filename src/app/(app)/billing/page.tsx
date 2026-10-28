import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { AGING_BUCKETS, CHARGE_CATEGORIES, PAYMENT_METHODS, categoryLabel, methodLabel, prevMonth, receivables } from "@/lib/billing";
import { dailyCollections, monthSummary, pctChange } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { addDays, formatPhp, todayManila } from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isMonth = (v?: string) => Boolean(v && /^\d{4}-\d{2}$/.test(v));
const name = (p: { firstName: string; lastName: string | null }) => `${p.firstName} ${p.lastName ?? ""}`.trim();
const monthLabel = (m: string) => new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ tab?: string; date?: string; month?: string }> }) {
  const user = await requirePermission("billing:read");
  const sp = await searchParams;
  const reports = can(user.role, "reports:read");
  const tabs = [
    { key: "today", label: "Daily collections" },
    ...(reports ? [{ key: "receivables", label: "Receivables" }, { key: "monthly", label: "Monthly report" }] : []),
  ];
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "today";
  await audit({ userId: user.id, action: "VIEW", entity: "Report", detail: `billing:${tab}` });

  return (
    <>
      <PageHeader title="Billing" subtitle="Collections, receivables, and monthly performance" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
        {tabs.map((t) => (
          <Link key={t.key} href={`/billing?tab=${t.key}`} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "today" && <Collections date={isDate(sp.date) ? sp.date! : todayManila()} />}
      {tab === "receivables" && reports && <Receivables />}
      {tab === "monthly" && reports && <Monthly month={isMonth(sp.month) ? sp.month! : todayManila().slice(0, 7)} />}
    </>
  );
}

async function Collections({ date }: { date: string }) {
  const r = await dailyCollections(date);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/billing?tab=today&date=${addDays(date, -1)}`} className="btn-secondary">←</Link>
        <form className="flex gap-2"><input type="hidden" name="tab" value="today" /><input className="input" type="date" name="date" defaultValue={date} /><button className="btn-secondary">Go</button></form>
        <Link href={`/billing?tab=today&date=${addDays(date, 1)}`} className="btn-secondary">→</Link>
        <PrintButton label="Print" className="btn-secondary" />
      </div>
      <section className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div><div className="muted">Total {date}</div><div className="text-2xl font-semibold">{formatPhp(r.total)}</div></div>
        {PAYMENT_METHODS.map((m) => (
          <div key={m.key}><div className="muted">{m.label}</div><div className="font-medium">{formatPhp(r.byMethod[m.key] ?? 0)}</div></div>
        ))}
      </section>
      {r.payments.length === 0 ? <EmptyState>Walang payment sa araw na ito.</EmptyState> : (
        <section className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-1">Receipt</th><th>Patient</th><th>Method</th><th>Ref / OR</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {r.payments.map((p) => (
                <tr key={p.id} className={`border-t border-slate-100 ${p.voidedAt ? "text-slate-400 line-through" : ""}`}>
                  <td className="py-1 pr-2"><Link href={`/print/receipts/${p.id}`} target="_blank" className="text-brand-700 underline">{p.receiptNo}</Link></td>
                  <td className="pr-2"><Link href={`/patients/${p.patient.id}?tab=billing`} className="hover:underline">{name(p.patient)}</Link></td>
                  <td className="pr-2">{methodLabel(p.method)}</td>
                  <td className="pr-2">{[p.reference, p.orNumber && `OR ${p.orNumber}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="text-right">{formatPhp(p.amountPhp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.voided > 0 && <p className="muted mt-2 text-xs">{r.voided} voided payment(s) not counted.</p>}
        </section>
      )}
    </div>
  );
}

async function Receivables() {
  const r = await receivables();
  return (
    <div className="space-y-4">
      <section className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div><div className="muted">Total outstanding</div><div className="text-2xl font-semibold text-red-700">{formatPhp(r.total)}</div></div>
        {AGING_BUCKETS.map((b) => (
          <div key={b}><div className="muted">{b} days</div><div className="font-medium">{formatPhp(r.totals[b])}</div></div>
        ))}
      </section>
      {r.rows.length === 0 ? <EmptyState>Walang utang na balanse. 🎉</EmptyState> : (
        <section className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-1">Patient</th>{AGING_BUCKETS.map((b) => <th key={b} className="text-right">{b}</th>)}<th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.patientId} className="border-t border-slate-100">
                  <td className="py-1 pr-2">
                    <Link href={`/patients/${row.patientId}?tab=billing`} className="text-brand-700 hover:underline">{name(row.patient)}</Link>
                    <div className="muted text-xs">{row.patient.patientNo} · since {row.oldest}</div>
                  </td>
                  {AGING_BUCKETS.map((b) => <td key={b} className={`text-right ${row.buckets[b] && b !== "0-30" ? "text-red-700" : ""}`}>{row.buckets[b] ? formatPhp(row.buckets[b]) : "—"}</td>)}
                  <td className="text-right font-medium">{formatPhp(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Delta({ now, before, money }: { now: number; before: number; money?: boolean }) {
  const pct = pctChange(now, before);
  return (
    <span className="muted text-xs">
      vs {money ? formatPhp(before) : before}
      {pct !== null && pct !== 0 ? ` (${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%)` : ""}
    </span>
  );
}

async function Monthly({ month }: { month: string }) {
  const [m, p] = await Promise.all([monthSummary(month), monthSummary(prevMonth(month))]);
  const tiles: { label: string; key: keyof typeof m; money?: boolean }[] = [
    { label: "Collected", key: "collected", money: true },
    { label: "Charged (services)", key: "charged", money: true },
    { label: "Receivables at month end", key: "receivablesAtEnd", money: true },
    { label: "Average collected per paying patient", key: "avgPerPatient", money: true },
    { label: "New patients", key: "newPatients" },
    { label: "Consultations attended", key: "attended" },
    { label: "No-shows", key: "noShows" },
    { label: "Treatment sessions", key: "sessions" },
    { label: "Packages sold", key: "packagesSold" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/billing?tab=monthly&month=${prevMonth(month)}`} className="btn-secondary">←</Link>
        <form className="flex gap-2"><input type="hidden" name="tab" value="monthly" /><input className="input" type="month" name="month" defaultValue={month} /><button className="btn-secondary">Go</button></form>
        <PrintButton label="Print / PDF" className="btn-secondary" />
      </div>
      <h2>{monthLabel(month)} <span className="muted text-sm font-normal">compared with {monthLabel(p.month)}</span></h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.key} className="card">
            <div className="muted text-sm">{t.label}</div>
            <div className="text-xl font-semibold">{t.money ? formatPhp(m[t.key] as number) : (m[t.key] as number)}</div>
            <Delta now={m[t.key] as number} before={p[t.key] as number} money={t.money} />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card text-sm">
          <h2 className="mb-2">Collected by method</h2>
          <table className="w-full">
            <tbody>
              {PAYMENT_METHODS.map((x) => (
                <tr key={x.key} className="border-t border-slate-100"><td className="py-1">{x.label}</td><td className="text-right">{formatPhp(m.byMethod[x.key] ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card text-sm">
          <h2 className="mb-2">Charged by service</h2>
          <table className="w-full">
            <tbody>
              {CHARGE_CATEGORIES.map((c) => (
                <tr key={c.key} className="border-t border-slate-100"><td className="py-1">{categoryLabel(c.key)}</td><td className="text-right">{formatPhp(m.byCategory[c.key] ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
