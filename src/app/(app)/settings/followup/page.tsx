import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { BackLink, PageHeader } from "@/components/ui";
import { saveFollowUpSettings } from "../actions";

export default async function FollowUpSettings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const keys = ["recallEnabled", "recallRepeatDays", "recallMaxCount", "stalledPlanDays", "recallInactiveDays", "feedbackEnabled", "feedbackEveryDays", "receiptHeader"] as const;
  const v = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSetting(k)] as const))) as Record<(typeof keys)[number], string>;
  const num = (name: keyof typeof v, label: string, min: number, max: number) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type="number" name={name} min={min} max={max} defaultValue={v[name]} required />
    </label>
  );
  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader title="Follow-up & billing settings" />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      <form action={saveFollowUpSettings} className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 text-sm">
          <h2>Recall reminders</h2>
          <label className="flex items-center gap-2"><input type="checkbox" name="recallEnabled" defaultChecked={v.recallEnabled === "1"} /> Send follow-up and missed-session reminders automatically</label>
          {num("recallRepeatDays", "Days between reminders when a follow-up is overdue", 1, 60)}
          {num("recallMaxCount", "Maximum reminders per follow-up", 1, 10)}
          {num("stalledPlanDays", "Missed session: no session in a started plan for (days)", 3, 120)}
          {num("recallInactiveDays", "Recall list: no visit for (days)", 14, 730)}
          <p className="muted text-xs">Messages go out 9 AM to 6 PM only, and never to patients who already have a booking.</p>
        </section>
        <section className="card space-y-3 text-sm">
          <h2>Feedback</h2>
          <label className="flex items-center gap-2"><input type="checkbox" name="feedbackEnabled" defaultChecked={v.feedbackEnabled === "1"} /> Ask for feedback after an attended consultation</label>
          {num("feedbackEveryDays", "Ask the same patient at most once every (days)", 1, 365)}
          <h2 className="pt-2">Acknowledgement receipt</h2>
          <label className="block">
            <span className="label">Header lines (registered name, TIN, address)</span>
            <textarea className="input" name="receiptHeader" rows={4} maxLength={400} defaultValue={v.receiptHeader} placeholder={"Clinica Medica 101 Center for Complementary Medicine\nTIN 000-000-000-000\nCenturia Medical Makati"} />
          </label>
          <p className="muted text-xs">Ang acknowledgement receipt ay hindi official receipt (OR) ng BIR. Isulat ang OR number sa payment kung nag-issue kayo ng OR.</p>
        </section>
        <button className="btn md:col-span-2 md:justify-self-start">Save</button>
      </form>
    </>
  );
}
