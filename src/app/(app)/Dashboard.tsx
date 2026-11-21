import Link from "next/link";
import { pctChange } from "@/lib/reports";
import {
  nextPeriod, periodFunnel, periodMetrics, periodReach, previousPeriod, rate, weeklyTrend,
  type FunnelRow, type Metrics, type Period,
} from "@/lib/dashboard";
import { formatPhp, todayManila } from "@/lib/time";
import { TrendChart } from "@/components/TrendChart";

// One colour per tile: [top bar gradient, soft background, number colour]. Full class names so Tailwind keeps them.
const TONES = {
  sky: ["from-sky-400 to-blue-500", "from-sky-50", "text-sky-700"],
  violet: ["from-violet-400 to-indigo-500", "from-violet-50", "text-violet-700"],
  emerald: ["from-emerald-400 to-green-600", "from-emerald-50", "text-emerald-700"],
  teal: ["from-teal-400 to-cyan-500", "from-teal-50", "text-teal-700"],
  amber: ["from-amber-400 to-orange-500", "from-amber-50", "text-amber-700"],
  green: ["from-lime-400 to-emerald-500", "from-lime-50", "text-green-700"],
  rose: ["from-rose-400 to-pink-500", "from-rose-50", "text-rose-700"],
} as const;

const TILES: { key: keyof Metrics; label: string; tone: keyof typeof TONES; money?: boolean; lowerIsBetter?: boolean; hint?: string }[] = [
  { key: "inquiries", label: "New inquiries", tone: "sky" },
  { key: "booked", label: "Consultations booked", tone: "violet" },
  { key: "attended", label: "Patients who attended", tone: "emerald" },
  { key: "continuedTreatment", label: "Started treatment", tone: "teal", hint: "Plans started (with consent) in this period" },
  { key: "returned", label: "Returned for follow-up", tone: "amber", hint: "Patients with a session or repeat consult" },
  { key: "collected", label: "Collected", tone: "green", money: true },
  { key: "outstanding", label: "Outstanding receivables", tone: "rose", money: true, lowerIsBetter: true, hint: "As of the end of the period" },
];

const BAR_COLORS = ["from-sky-400 to-blue-500", "from-violet-400 to-indigo-500", "from-emerald-400 to-green-600", "from-amber-400 to-orange-500"];

function Change({ now, before, lowerIsBetter }: { now: number; before: number; lowerIsBetter?: boolean }) {
  const pct = pctChange(now, before);
  if (pct === null || pct === 0) return <span className="muted">{pct === 0 ? "no change" : "new"}</span>;
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return <span className={good ? "text-emerald-700" : "text-red-700"}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

const pctText = (n: number | null) => (n === null ? "—" : `${n}%`);

function FunnelTable({ title, rows, total }: { title: string; rows: FunnelRow[]; total?: FunnelRow }) {
  const all = total ? [...rows, total] : rows;
  const showVisits = rows.some((r) => (r.visits ?? 0) > 0);
  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-2">{title}</h2>
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-sky-50 text-left text-xs text-sky-900">
          <tr>
            <th className="rounded-l-md px-1 py-1.5">Source</th>{showVisits && <th className="text-right">Page visits</th>}<th className="text-right">Inquiries</th><th className="text-right">Booked</th>
            <th className="text-right">Attended</th><th className="text-right">Treatment</th><th className="rounded-r-md pr-1 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.key} className={`border-t border-slate-100 ${r.key === "TOTAL" ? "bg-emerald-50 font-semibold text-emerald-900" : ""}`}>
              <td className="px-1 py-1.5 pr-2">{r.label}</td>
              {showVisits && <td className="text-right">{r.visits ? r.visits : r.key === "TOTAL" ? "" : "—"}</td>}
              <td className="text-right">{r.inquiries}</td>
              <td className="text-right">{r.booked} <span className="muted text-xs">{pctText(rate(r.booked, r.inquiries))}</span></td>
              <td className="text-right">{r.attended} <span className="muted text-xs">{pctText(rate(r.attended, r.booked))}</span></td>
              <td className="text-right">{r.treatment} <span className="muted text-xs">{pctText(rate(r.treatment, r.attended))}</span></td>
              <td className="pr-1 text-right">{formatPhp(r.revenue)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted py-2">Walang bagong inquiry sa period na ito.</td></tr>}
        </tbody>
      </table>
      <p className="muted mt-2 text-xs">{showVisits && "Page visits = landing page (/start) views; inquiries also include Messenger and other channels. "}Small % = conversion from the previous column. Counts the inquiries that came in during this period and what they did after, up to today.</p>
    </section>
  );
}

export async function Dashboard({ period }: { period: Period }) {
  const prev = previousPeriod(period);
  const [m, p, funnel, reach, trend] = await Promise.all([
    periodMetrics(period), periodMetrics(prev), periodFunnel(period), periodReach(period), weeklyTrend(period.end),
  ]);
  const isCurrent = period.end >= todayManila();
  const q = (per: Period) => `/?period=${per.kind}&date=${per.start}`;
  const t = funnel.total;

  return (
    <section className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg">{period.label}</h2>
          <p className="muted text-xs">Compared with {prev.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {(["week", "month"] as const).map((k) => (
              <Link key={k} href={`/?period=${k}&date=${period.start}`} className={`px-3 py-1.5 ${period.kind === k ? "bg-gradient-to-r from-brand-600 to-teal-600 text-white" : "bg-white text-slate-600"}`}>
                {k === "week" ? "Week" : "Month"}
              </Link>
            ))}
          </div>
          <Link href={q(prev)} className="btn-secondary" aria-label="Previous period">←</Link>
          {!isCurrent && <Link href={q(nextPeriod(period))} className="btn-secondary" aria-label="Next period">→</Link>}
          {!isCurrent && <Link href={`/?period=${period.kind}`} className="btn-secondary">Now</Link>}
          <a href={`/api/export/dashboard?period=${period.kind}&date=${period.start}`} className="btn-secondary">Export CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {TILES.map((tile) => (
          <div key={tile.key} className={`card relative overflow-hidden bg-gradient-to-br to-white ${TONES[tile.tone][1]}`} title={tile.hint}>
            <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${TONES[tile.tone][0]}`} aria-hidden="true" />
            <div className="muted text-xs">{tile.label}</div>
            <div className={`text-2xl font-bold ${TONES[tile.tone][2]}`}>{tile.money ? formatPhp(m[tile.key] as number) : (m[tile.key] as number)}</div>
            <div className="text-xs">
              <Change now={m[tile.key] as number} before={p[tile.key] as number} lowerIsBetter={tile.lowerIsBetter} />{" "}
              <span className="muted">vs {tile.money ? formatPhp(p[tile.key] as number) : (p[tile.key] as number)}</span>
            </div>
            {tile.key === "attended" && <div className="muted text-xs">No-show rate {pctText(m.noShowRate)} ({m.noShows})</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card md:col-span-2">
          <h2 className="mb-2">Last 8 weeks</h2>
          <TrendChart rows={trend} />
        </section>
        <section className="card text-sm">
          <h2 className="mb-2">Conversion</h2>
          <p className="muted mb-2 text-xs">Inquiries that came in this period</p>
          {[
            ["Inquiry → booked", rate(t.booked, t.inquiries)],
            ["Booked → attended", rate(t.attended, t.booked)],
            ["Attended → treatment", rate(t.treatment, t.attended)],
            ["Inquiry → attended", rate(t.attended, t.inquiries)],
          ].map(([label, v], i) => (
            <div key={label as string} className="mb-2">
              <div className="flex justify-between"><span>{label}</span><b>{pctText(v as number | null)}</b></div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={`h-1.5 rounded-full bg-gradient-to-r ${BAR_COLORS[i]}`} style={{ width: `${v ?? 0}%` }} /></div>
            </div>
          ))}
        </section>
      </div>

      <FunnelTable title="Which channel brought patients who actually consulted" rows={funnel.bySource} total={funnel.total} />
      <FunnelTable title="By campaign" rows={funnel.byCampaign} />

      <section className="card text-sm">
        <h2 className="mb-1">Reach (manual, not outcomes)</h2>
        <p className="muted mb-2 text-xs">Views and likes you typed in under More → Campaigns. Shown separately because they don&apos;t mean patients consulted.</p>
        {reach.length === 0 ? <p className="muted">No views/likes entered for this period.</p> : (
          <table className="w-full">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Campaign</th><th className="text-right">Views</th><th className="text-right">Likes</th></tr></thead>
            <tbody>
              {reach.map((r) => (
                <tr key={r.name} className="border-t border-slate-100"><td className="py-1">{r.name}</td><td className="text-right">{r.views.toLocaleString("en-PH")}</td><td className="text-right">{r.likes.toLocaleString("en-PH")}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
