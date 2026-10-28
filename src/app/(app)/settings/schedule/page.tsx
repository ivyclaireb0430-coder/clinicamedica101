import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { WEEKDAYS } from "@/lib/constants";
import { formatPhp, todayManila } from "@/lib/time";
import { getNumberSetting } from "@/lib/settings";
import { BackLink, PageHeader } from "@/components/ui";
import {
  addBlockedDate, addScheduleRule, deleteBlockedDate, deleteScheduleRule, saveConsultationType, saveFollowUpDays,
} from "../actions";

export default async function SchedulePage() {
  const user = await requirePermission("booking:write");
  const manage = can(user.role, "settings:manage");
  const [rules, blocked, types, followUpDays] = await Promise.all([
    db.scheduleRule.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    db.blockedDate.findMany({ where: { date: { gte: todayManila() } }, orderBy: { date: "asc" } }),
    db.consultationType.findMany({ orderBy: { sortOrder: "asc" } }),
    getNumberSetting("followUpDays"),
  ]);

  return (
    <>
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Schedule, fees & closed dates" />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3">
          <h2>Clinic hours</h2>
          <ul className="space-y-1 text-sm">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span>{WEEKDAYS[r.weekday]} · {r.startTime}–{r.endTime}</span>
                <form action={deleteScheduleRule.bind(null, r.id)}>
                  <button className="text-xs text-red-600 hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addScheduleRule} className="grid grid-cols-3 gap-2">
            <select name="weekday" className="input col-span-3 sm:col-span-1">
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <input type="time" name="startTime" className="input" defaultValue="09:00" required />
            <input type="time" name="endTime" className="input" defaultValue="17:00" required />
            <button className="btn-secondary col-span-3">Add hours</button>
          </form>
        </section>

        <section className="card space-y-3">
          <h2>Closed dates</h2>
          <ul className="space-y-1 text-sm">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <span>{b.date}{b.reason ? ` · ${b.reason}` : ""}</span>
                <form action={deleteBlockedDate.bind(null, b.id)}>
                  <button className="text-xs text-red-600 hover:underline">Remove</button>
                </form>
              </li>
            ))}
            {blocked.length === 0 && <li className="muted">None upcoming.</li>}
          </ul>
          <form action={addBlockedDate} className="grid grid-cols-2 gap-2">
            <input type="date" name="date" className="input" required />
            <input name="reason" className="input" placeholder="Reason (optional)" />
            <button className="btn-secondary col-span-2">Add closed date</button>
          </form>
        </section>

        {manage && (
          <section className="card space-y-3 md:col-span-2">
            <h2>Consultation types & fees</h2>
            {types.map((t) => (
              <form key={t.id} action={saveConsultationType.bind(null, t.id)} className="grid gap-2 border-b border-slate-100 pb-3 sm:grid-cols-6">
                <input name="name" className="input sm:col-span-2" defaultValue={t.name} />
                <input name="durationMin" type="number" className="input" defaultValue={t.durationMin} title="Minutes" />
                <input name="feePhp" type="number" className="input" defaultValue={t.feePhp} title="Fee (PHP)" />
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="active" defaultChecked={t.active} /> Active
                </label>
                <button className="btn-secondary">Save</button>
                <input name="description" className="input sm:col-span-6" defaultValue={t.description ?? ""} placeholder="What's included" />
                <span className="muted sm:col-span-6">{t.durationMin} min · {formatPhp(t.feePhp)}</span>
              </form>
            ))}
            <form action={saveConsultationType.bind(null, null)} className="grid gap-2 sm:grid-cols-6">
              <input name="name" className="input sm:col-span-2" placeholder="New type name" required />
              <input name="durationMin" type="number" className="input" placeholder="Minutes" required />
              <input name="feePhp" type="number" className="input" placeholder="Fee ₱" required />
              <button className="btn-secondary sm:col-span-2">Add type</button>
            </form>
          </section>
        )}

        {manage && (
          <section className="card space-y-3">
            <h2>Follow-up timing</h2>
            <form action={saveFollowUpDays} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="followUpDays">Days without booking before “Needs follow-up”</label>
                <input id="followUpDays" name="followUpDays" type="number" min={1} max={60} className="input" defaultValue={followUpDays} />
              </div>
              <button className="btn-secondary">Save</button>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
