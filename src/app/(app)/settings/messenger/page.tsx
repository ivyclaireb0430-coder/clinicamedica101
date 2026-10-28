import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { messengerConfigured, REMINDER_TEMPLATE_BODY } from "@/lib/messenger/meta";
import { googleConfigured } from "@/lib/google";
import { BackLink, PageHeader } from "@/components/ui";
import { saveMessengerSettings, setupReminderTemplate } from "../actions";

export default async function MessengerSettings({ searchParams }: { searchParams: Promise<{ saved?: string; template?: string; template_error?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const [automation, reminders, sms, noShowHours, template] = await Promise.all([
    getSetting("automationEnabled"), getSetting("remindersEnabled"), getSetting("smsEnabled"), getSetting("autoNoShowHours"), getSetting("utilityTemplateName"),
  ]);
  const smsReady = Boolean(process.env.SEMAPHORE_API_KEY);
  const appUrl = process.env.APP_URL ?? "https://your-domain";

  return (
    <>
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Messenger & reminders" />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      {sp.template && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Reminder template created on Meta.</p>}
      {sp.template_error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Meta error: {sp.template_error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <form action={saveMessengerSettings} className="card space-y-3 text-sm">
          <h2>Automation</h2>
          <label className="flex items-center gap-2"><input type="checkbox" name="automationEnabled" defaultChecked={automation === "1"} /> Messenger auto-replies</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="remindersEnabled" defaultChecked={reminders === "1"} /> Automatic appointment reminders</label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="smsEnabled" defaultChecked={sms === "1"} /> SMS fallback (Semaphore, paid per text)
          </label>
          {!smsReady && <p className="muted">SMS won&apos;t send until SEMAPHORE_API_KEY is added to the server settings.</p>}
          <div>
            <label className="label" htmlFor="autoNoShowHours">Auto-mark No-show after (hours past end time)</label>
            <input id="autoNoShowHours" name="autoNoShowHours" type="number" min={1} max={48} className="input" defaultValue={noShowHours} />
          </div>
          <button className="btn">Save</button>
        </form>

        <section className="card space-y-2 text-sm">
          <h2>Connection status</h2>
          <div>Facebook Page: <b>{messengerConfigured() ? "Connected" : "Not set up yet"}</b></div>
          <div>Gmail (email reminders, doctor alerts): <b>{googleConfigured() ? "Uses the Google connection" : "Not set up yet"}</b></div>
          <div>SMS: <b>{smsReady ? "API key set" : "No API key yet"}</b></div>
          <div className="muted break-all">Webhook URL for the Meta app: {appUrl}/api/webhooks/messenger</div>
          <div className="muted">Reminders cron: {appUrl}/api/cron/reminders (every 15 minutes)</div>
        </section>

        <section className="card space-y-2 text-sm md:col-span-2">
          <h2>Reminders outside the 24-hour window</h2>
          <p>
            Meta only allows free replies within 24 hours of the patient&apos;s last message. For reminders after that, Meta requires an
            approved <b>utility template</b>. Order the system tries: Messenger (within 24h) → Messenger template → email → SMS.
          </p>
          <p className="rounded bg-slate-50 p-2 text-xs">{REMINDER_TEMPLATE_BODY}</p>
          <p>Template: <b>{template || "not created yet"}</b></p>
          <form action={setupReminderTemplate}>
            <button className="btn-secondary" disabled={!messengerConfigured()}>Create template on Meta</button>
          </form>
          <p className="muted">Needs the page_utility_messaging permission on the Meta app.</p>
        </section>
      </div>
    </>
  );
}
