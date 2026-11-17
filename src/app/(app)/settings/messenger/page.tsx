import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { messengerConfigured, REMINDER_TEMPLATE_BODY } from "@/lib/messenger/meta";
import { googleConfigured } from "@/lib/google";
import { BackLink, PageHeader } from "@/components/ui";
import { saveAiApiKey, saveAiSettings, saveMessengerSettings, setupReminderTemplate } from "../actions";
import { aiConfigured } from "@/lib/messenger/ai";
import { aiApiKey, aiUsageToday } from "@/lib/messenger/ai-context";
import { AiTester } from "./AiTester";

export default async function MessengerSettings({ searchParams }: { searchParams: Promise<{ saved?: string; template?: string; template_error?: string; key_error?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const [automation, reminders, sms, noShowHours, template] = await Promise.all([
    getSetting("automationEnabled"), getSetting("remindersEnabled"), getSetting("smsEnabled"), getSetting("autoNoShowHours"), getSetting("utilityTemplateName"),
  ]);
  const [aiOn, aiHealth, aiLimit, aiUsed] = await Promise.all([getSetting("aiRepliesEnabled"), getSetting("aiHealthInquiries"), getSetting("aiDailyLimit"), aiUsageToday()]);
  const aiFromServer = aiConfigured();
  const aiReady = Boolean(await aiApiKey());
  const smsReady = Boolean(process.env.SEMAPHORE_API_KEY);
  const appUrl = process.env.APP_URL ?? "https://your-domain";

  return (
    <>
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Messenger & reminders" />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      {sp.template && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Reminder template created on Meta.</p>}
      {sp.key_error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Mukhang hindi buo ang API key. Dapat nagsisimula ito sa sk-ant- at walang ibang kasama.</p>}
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

        <section className="card space-y-3 text-sm md:col-span-2">
          <h2>AI replies (Messenger inquiries)</h2>
          <p>
            Kapag hindi tugma sa mga button o keyword ang message (hal. galing sa ad: &quot;interested po&quot;, &quot;may HMO ba?&quot;), ang AI ang
            sasagot gamit lang ang clinic info: fees, promo, oras, location, services, at hihikayatin silang mag-book. Hindi ito
            nagbibigay ng medical advice. Ang emergency ay laging ipinapasa sa doktor na may payong pumunta sa ER.
          </p>
          <div>AI provider key: <b>{aiFromServer ? "Set (sa server)" : aiReady ? "Set" : "Not set yet"}</b> · Nagamit ngayong araw: <b>{aiUsed}</b> / {aiLimit}</div>
          {!aiFromServer && (
            <form action={saveAiApiKey} className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <label className="label" htmlFor="apiKey">{aiReady ? "Palitan ang Anthropic API key" : "I-paste ang Anthropic API key (nagsisimula sa sk-ant-)"}</label>
                <input id="apiKey" name="apiKey" type="password" autoComplete="off" className="input" placeholder="sk-ant-..." required />
              </div>
              <button className="btn">I-save ang key</button>
              {aiReady && (
                <button className="btn-secondary" name="clear" value="1" formNoValidate>Alisin</button>
              )}
            </form>
          )}
          {!aiFromServer && <p className="muted text-xs">Naka-encrypt ang key sa database at hindi na ito ipinapakita ulit.</p>}
          <form action={saveAiSettings} className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="aiRepliesEnabled" defaultChecked={aiOn === "1"} disabled={!aiReady} /> I-on ang AI replies
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="aiHealthInquiries" defaultChecked={aiHealth === "1"} /> Sagutin din ang mga tanong tungkol sa sakit
              (walang medical advice, iimbitahang mag-book; aabisuhan pa rin ang doktor)
            </label>
            <div>
              <label className="label" htmlFor="aiDailyLimit">Max AI replies bawat araw</label>
              <input id="aiDailyLimit" name="aiDailyLimit" type="number" min={0} max={5000} className="input w-28" defaultValue={aiLimit} />
            </div>
            <button className="btn">Save</button>
          </form>
          <p>
            <a className="underline" href="/settings/messenger/examples">Halimbawang reply para sa AI →</a> Pumili ng mga dating reply ng
            staff para gayahin ng AI ang tono ninyo.
          </p>
          <p className="muted">Kapag naka-on, idinadagdag sa Privacy Notice na ang mga general na message ay pinoproseso ng AI provider.</p>
          {aiReady && (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="mb-2 font-semibold">Subukan muna</h3>
              <AiTester />
            </div>
          )}
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
