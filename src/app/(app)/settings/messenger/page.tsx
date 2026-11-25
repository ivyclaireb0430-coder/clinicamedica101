import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { messengerConfigured, REMINDER_TEMPLATE_BODY } from "@/lib/messenger/meta";
import { googleConfigured } from "@/lib/google";
import { loadSmtp } from "@/lib/email";
import { BackLink, PageHeader } from "@/components/ui";
import { saveCommentSettings, saveFacebookKeys, saveAiApiKey, saveAiSettings, resubscribeWebhooks, saveMessengerSettings, setupReminderTemplate } from "../actions";
import { aiConfigured } from "@/lib/messenger/ai";
import { aiApiKey, aiUsageToday } from "@/lib/messenger/ai-context";
import { AiTester } from "./AiTester";
import { META_FIELDS, SECRET_FIELDS, fieldsFromServer, loadStoredMetaCreds, type MetaField } from "@/lib/messenger/meta-creds";

const FB_ERRORS: Record<string, string> = {
  appid: "App ID (numero lang)",
  pageid: "Page ID (numero lang)",
  secret: "App Secret (32 na letra at numero)",
  token: "Page access token (nagsisimula sa EAA)",
  username: "Page username (walang @ o space)",
};

export default async function MessengerSettings({ searchParams }: { searchParams: Promise<{ comment_error?: string; saved?: string; template?: string; template_error?: string; key_error?: string; fb_error?: string; webhook?: string; webhook_error?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const [automation, reminders, sms, noShowHours, template] = await Promise.all([
    getSetting("automationEnabled"), getSetting("remindersEnabled"), getSetting("smsEnabled"), getSetting("autoNoShowHours"), getSetting("utilityTemplateName"),
  ]);
  const [aiOn, aiHealth, aiLimit, aiUsed] = await Promise.all([getSetting("aiRepliesEnabled"), getSetting("aiHealthInquiries"), getSetting("aiDailyLimit"), aiUsageToday()]);
  const [commentOn, commentPrivate, commentPublic] = await Promise.all([getSetting("commentRepliesEnabled"), getSetting("commentPrivateText"), getSetting("commentPublicText")]);
  const fbFromServer = fieldsFromServer();
  const fbStored = await loadStoredMetaCreds().catch(() => ({}) as Partial<Record<MetaField, string>>);
  const verifyToken = process.env.META_VERIFY_TOKEN ?? "";
  const aiFromServer = aiConfigured();
  const aiReady = Boolean(await aiApiKey());
  const smsReady = Boolean(process.env.SEMAPHORE_API_KEY);
  const smtpReady = Boolean(await loadSmtp());
  const appUrl = process.env.APP_URL ?? "https://your-domain";

  return (
    <>
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Messenger & reminders" />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}
      {sp.template && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Reminder template created on Meta.</p>}
      {sp.webhook && <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">Naka-subscribe na ulit ang Page sa Messenger webhook. ✅</p>}
      {sp.webhook_error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Hindi na-subscribe ang webhook: {sp.webhook_error}</p>}
      {sp.fb_error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Mukhang mali ang {FB_ERRORS[sp.fb_error] ?? "Facebook key"}. Baka na-autofill ng browser ang email o password; burahin at ilagay ang tamang value.</p>}
      {sp.comment_error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Kulang o masyadong mahaba ang message para sa mga nag-comment.</p>}
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
          <div>Email (reminders, doctor alerts): <b>{smtpReady ? "Clinic mailbox" : googleConfigured() ? "Uses the Google connection" : "Not set up yet"}</b> · <a className="underline" href="/settings/email">Settings → Email</a></div>
          <div>SMS: <b>{smsReady ? "API key set" : "No API key yet"}</b></div>
          <div className="muted break-all">Webhook URL for the Meta app: {appUrl}/api/webhooks/messenger</div>
          <div className="muted">Reminders cron: {appUrl}/api/cron/reminders (every 15 minutes)</div>
        </section>

        <section className="card space-y-3 text-sm md:col-span-2">
          <h2>Facebook Page connection</h2>
          <p>Kopyahin ang dalawang ito papunta sa Meta app → Messenger API Settings → Configure webhooks:</p>
          <div className="space-y-1 rounded bg-slate-50 p-2">
            <div className="break-all">Callback URL: <b className="select-all">{appUrl}/api/webhooks/messenger</b></div>
            <div className="break-all">Verify token: <b className="select-all">{verifyToken || "wala (META_VERIFY_TOKEN)"}</b></div>
          </div>
          <WebhookStatus />
          <form action={saveFacebookKeys} className="grid gap-2 md:grid-cols-2">
            {(Object.keys(META_FIELDS) as MetaField[]).map((k) => {
              const onServer = fbFromServer.has(k);
              const saved = Boolean(fbStored[k]);
              const secret = SECRET_FIELDS.includes(k);
              return (
                <div key={k}>
                  <label className="label" htmlFor={k}>
                    {META_FIELDS[k]} {onServer ? "· set sa server" : saved ? "· naka-save ✓" : ""}
                  </label>
                  <input
                    id={k}
                    name={k}
                    // No type="password" here: browsers fill a saved login (email + password) into the
                    // nearest text/password pair and ignore autocomplete. Mask secrets with CSS instead.
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    style={secret ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
                    data-1p-ignore
                    data-lpignore="true"
                    className="input"
                    disabled={onServer}
                    placeholder={saved ? (secret ? "naka-save (iwanang blangko para hindi palitan)" : fbStored[k]) : ""}
                  />
                </div>
              );
            })}
            <div className="flex items-end gap-2">
              <button className="btn">I-save ang Facebook keys</button>
              {Object.keys(fbStored).length > 0 && <button className="btn-secondary" name="clear" value="1">Alisin lahat</button>}
            </div>
          </form>
          <p className="muted text-xs">Naka-encrypt ang mga key at hindi na ipinapakita ulit. Iwanang blangko ang field para hindi palitan.</p>
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
                <input id="apiKey" name="apiKey" type="text" autoComplete="off" spellCheck={false} style={{ WebkitTextSecurity: "disc" } as React.CSSProperties} data-1p-ignore data-lpignore="true" className="input" placeholder="sk-ant-..." required />
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
          <p>
            <a className="btn inline-block" href="/settings/messenger/train">Turuan ang AI →</a>{" "}
            <span className="muted">Kausapin ang AI para turuan ito ng impormasyon at ng paraan ng pagsagot, gaya ng sa Meta AI.</span>
          </p>
          <p>
            <a className="btn-secondary inline-block" href="/settings/messenger/practice">Practice chat →</a>{" "}
            <span className="muted">Kausapin ang buong bot (AI, buttons at booking) na parang pasyente. Walang ipinapadala.</span>
          </p>
          {aiReady && (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="mb-2 font-semibold">Subukan muna</h3>
              <AiTester />
            </div>
          )}
        </section>

        <section className="card space-y-3 text-sm md:col-span-2">
          <h2>Auto-message sa mga nag-comment (posts at ads)</h2>
          <p>
            Kapag may nag-comment sa post o ad ng Page, padadalhan sila ng isang private message sa Messenger. Kapag sumagot sila, ang bot at
            AI na ang bahala, at lalabas ang usapan sa Inbox. Isang message lang bawat tao bawat post sa loob ng 7 araw.
          </p>
          <p className="muted">
            Kailangan: sa Meta app, i-subscribe ang Page sa <b>feed</b> (bukod sa messages), at ang permission na pages_read_engagement
            (at pages_manage_engagement para sa public reply). Huwag itong i-on habang naka-on pa ang Botcake, para hindi doble ang message.
          </p>
          <form action={saveCommentSettings} className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="commentRepliesEnabled" defaultChecked={commentOn === "1"} /> I-on ang auto-message sa mga nag-comment
            </label>
            <div>
              <label className="label" htmlFor="commentPrivateText">Private message sa Messenger ({"{name}"} = pangalan ng nag-comment)</label>
              <textarea id="commentPrivateText" name="commentPrivateText" rows={3} maxLength={1000} className="input" defaultValue={commentPrivate} required />
            </div>
            <div>
              <label className="label" htmlFor="commentPublicText">Public reply sa comment (iwanang blangko kung ayaw)</label>
              <input id="commentPublicText" name="commentPublicText" maxLength={500} className="input" defaultValue={commentPublic} />
            </div>
            <button className="btn">Save</button>
          </form>
        </section>

        <section className="card space-y-2 text-sm md:col-span-2">
          <h2>Webhook ng Page</h2>
          <p>
            I-click kung hindi dumarating sa Inbox ang mga message, o pagkatapos palitan ang Page. Ise-subscribe ulit ang Page sa
            messages, postbacks, referrals at echoes.
          </p>
          <form action={resubscribeWebhooks}>
            <button className="btn-secondary" disabled={!messengerConfigured()}>I-subscribe ulit ang webhook</button>
          </form>
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

async function WebhookStatus() {
  const [okAt, badAt] = await Promise.all([getSetting("messengerLastOkAt"), getSetting("messengerLastBadSigAt")]);
  const ok = okAt ? new Date(okAt) : null;
  const bad = badAt ? new Date(badAt) : null;
  if (bad && (!ok || bad > ok)) {
    return (
      <p className="rounded-lg bg-red-50 p-2 text-red-700">
        May message galing Facebook noong {formatDateTime(bad)} pero tinanggihan dahil mali ang App Secret. I-paste ulit ang tamang
        App Secret mula sa Meta (App settings → Basic → Show) at i-save.
      </p>
    );
  }
  if (ok) return <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800">Huling message galing Facebook: {formatDateTime(ok)} ✓</p>;
  return <p className="muted">Wala pang natatanggap na message galing Facebook. Mag-message sa Page para i-test.</p>;
}
