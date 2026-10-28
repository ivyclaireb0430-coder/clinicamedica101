import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { getSetting } from "@/lib/settings";
import { doctorEmail } from "@/lib/google";
import { addDays, todayManila } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { saveWeeklyEmailSettings, sendWeeklyEmailNow } from "../actions";

const EXPORTS = [
  { kind: "leads", title: "Leads", desc: "Name, contact, source, campaign, stage. No health concern." },
  { kind: "appointments", title: "Appointments", desc: "Date, type, status, source", range: true },
  { kind: "payments", title: "Payments", desc: "Receipts, methods, references, voids", range: true },
  { kind: "receivables", title: "Receivables", desc: "Unpaid balances with aging, as of today" },
  { kind: "followups", title: "Follow-ups", desc: "Due dates, status, reminders sent" },
];

export default async function ExportsPage({ searchParams }: { searchParams: Promise<{ saved?: string; sent?: string; error?: string }> }) {
  const user = await requirePermission("reports:read");
  const sp = await searchParams;
  const manage = can(user.role, "settings:manage");
  const exportData = can(user.role, "data:export");
  const [enabled, to, last, fallback] = await Promise.all([
    getSetting("weeklyEmailEnabled"), getSetting("weeklyEmailTo"), getSetting("lastWeeklyEmailWeek"), doctorEmail(),
  ]);
  const today = todayManila();
  const monthAgo = addDays(today, -30);

  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader title="Reports & exports" subtitle="Monday email and CSV downloads" />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      {sp.sent === "1" && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Weekly summary sent.</p>}
      {sp.sent && sp.sent !== "1" && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Hindi naipadala: {sp.sent}. Kailangang naka-connect ang Google (Gmail) sa Settings → Google Calendar.</p>}
      {sp.error === "email" && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Invalid email address.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 text-sm">
          <h2>Monday summary email</h2>
          <p className="muted">Every Monday from 7 AM, last week&apos;s numbers go to your Gmail: inquiries, bookings, attendance, treatment, follow-ups, collections, and the channel funnel. Numbers only, walang pangalan o health details ng pasyente.</p>
          {manage ? (
            <form action={saveWeeklyEmailSettings} className="space-y-2">
              <label className="flex items-center gap-2"><input type="checkbox" name="weeklyEmailEnabled" defaultChecked={enabled === "1"} /> Send every Monday</label>
              <label className="block">
                <span className="label">Send to</span>
                <input className="input" type="email" name="weeklyEmailTo" defaultValue={to} placeholder={fallback ?? "doctor@gmail.com"} />
              </label>
              <button className="btn">Save</button>
            </form>
          ) : (
            <p>Sent to {to || fallback || "—"} · {enabled === "1" ? "on" : "off"}</p>
          )}
          <p className="muted text-xs">Last sent: {last ? `week of ${last}` : "not yet"}</p>
          {manage && (
            <form action={sendWeeklyEmailNow}>
              <button className="btn-secondary">Send last week&apos;s summary now</button>
            </form>
          )}
        </section>

        <section className="card space-y-3 text-sm">
          <h2>Download CSV</h2>
          <p className="muted">Opens in Excel, or in Google Sheets via File → Import → Upload. Every download is recorded in the audit log.</p>
          <a href={`/api/export/dashboard?period=week&date=${today}`} className="flex justify-between rounded border border-slate-200 p-2 hover:border-brand-500">
            <span><b>This week&apos;s dashboard</b><span className="muted block text-xs">Metrics and funnel, numbers only</span></span><span>↓</span>
          </a>
          <a href={`/api/export/dashboard?period=month&date=${today}`} className="flex justify-between rounded border border-slate-200 p-2 hover:border-brand-500">
            <span><b>This month&apos;s dashboard</b><span className="muted block text-xs">Metrics and funnel, numbers only</span></span><span>↓</span>
          </a>
          {exportData ? (
            EXPORTS.map((e) => (
              <a key={e.kind} href={`/api/export/${e.kind}${e.range ? `?from=${monthAgo}&to=${today}` : ""}`} className="flex justify-between rounded border border-slate-200 p-2 hover:border-brand-500">
                <span><b>{e.title}</b>{e.range && <span className="muted"> (last 30 days)</span>}<span className="muted block text-xs">{e.desc}</span></span><span>↓</span>
              </a>
            ))
          ) : (
            <p className="muted text-xs">Patient lists can only be downloaded by the Owner.</p>
          )}
          {exportData && <p className="muted text-xs">May personal data ang mga file na ito. Huwag i-share o i-upload kung saan-saan, at burahin kapag tapos na.</p>}
        </section>
      </div>
    </>
  );
}
