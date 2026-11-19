import { requirePermission } from "@/lib/session";
import { BackLink, PageHeader } from "@/components/ui";
import { SMTP_PRESETS, loadBrevo, loadSmtp } from "@/lib/email";
import { saveBrevoSettings, saveSmtpSettings, sendTestEmail } from "../actions";

export default async function EmailSettings({ searchParams }: { searchParams: Promise<{ saved?: string; test?: string; error?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const cfg = await loadSmtp();
  const brevo = await loadBrevo();
  return (
    <>
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Email (pagpapadala ng paalala)" />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Na-save. Subukan sa ibaba gamit ang test email.</p>}
      {sp.test === "ok" && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Naipadala ang test email. Tingnan ang inbox.</p>}
      {sp.error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <section className="card mb-4 space-y-3 text-sm">
        <p>
          Dito manggagaling ang mga email sa pasyente (paalala ng appointment) at ang mga abiso sa doktor. Kapag naka-set ito, ito ang
          gagamitin. Kung wala, ang naka-connect na Google account ang gagamitin.
        </p>
        <div>Status: <b>{brevo ? `Brevo ang ginagamit: ${brevo.from}` : cfg ? `Naka-set: ${cfg.user} (${cfg.host}:${cfg.port})` : "Hindi pa naka-set"}</b></div>
        <p className="muted">
          Hinaharangan ng DigitalOcean ang ports 25, 465 at 587. Para sa GoDaddy, piliin ang &quot;Iba&quot; at gamitin ang
          smtpout.secureserver.net port <b>3535</b>. Kung ayaw pa rin, gamitin ang Brevo sa ibaba.
        </p>
        <form action={saveSmtpSettings} className="grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label" htmlFor="preset">Saan naka-host ang email</label>
            <select id="preset" name="preset" className="input" defaultValue={cfg ? (cfg.host === SMTP_PRESETS.godaddy.host ? "godaddy" : cfg.host === SMTP_PRESETS.godaddy365.host ? "godaddy365" : "custom") : "godaddy365"}>
              {Object.entries(SMTP_PRESETS).map(([k, p]) => (
                <option key={k} value={k}>{p.label}</option>
              ))}
              <option value="custom">Iba (ilagay ang server at port sa ibaba)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="user">Email address</label>
            <input id="user" name="user" type="email" className="input" autoComplete="off" defaultValue={cfg?.user ?? "doctor@clinicamedica101.org"} required />
          </div>
          <div>
            <label className="label" htmlFor="pass">Password ng email {cfg ? "(iwanang blangko para hindi palitan)" : ""}</label>
            <input id="pass" name="pass" type="text" className="input" autoComplete="off" spellCheck={false} style={{ WebkitTextSecurity: "disc" } as React.CSSProperties} data-1p-ignore data-lpignore="true" />
          </div>
          <div>
            <label className="label" htmlFor="fromName">Pangalan ng sender</label>
            <input id="fromName" name="fromName" className="input" defaultValue={cfg?.fromName ?? "Clinica Medica 101"} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="host">Server (kung &quot;Iba&quot;)</label>
              <input id="host" name="host" className="input" defaultValue={cfg?.host ?? ""} placeholder="smtp.example.com" />
            </div>
            <div>
              <label className="label" htmlFor="port">Port</label>
              <input id="port" name="port" type="number" className="input" defaultValue={cfg?.port ?? 587} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button className="btn">I-save</button>
            {cfg && <button className="btn-secondary" name="clear" value="1" formNoValidate>Alisin</button>}
          </div>
        </form>
        <p className="muted text-xs">Naka-encrypt ang password at hindi na ipinapakita ulit.</p>
      </section>

      <section className="card mb-4 space-y-3 text-sm">
        <h2>Brevo (kung naharang ang SMTP)</h2>
        <p>
          Libreng email service (hanggang 300 email bawat araw) na dumadaan sa HTTPS, kaya hindi ito naharang ng DigitalOcean.
          doctor@clinicamedica101.org pa rin ang sender kapag na-verify ang domain sa Brevo. Kapag naka-set ito, ito ang gagamitin.
        </p>
        <form action={saveBrevoSettings} className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="from">Sender email</label>
            <input id="from" name="from" type="email" className="input" defaultValue={brevo?.from ?? "doctor@clinicamedica101.org"} required />
          </div>
          <div>
            <label className="label" htmlFor="brevoName">Pangalan ng sender</label>
            <input id="brevoName" name="fromName" className="input" defaultValue={brevo?.fromName ?? "Clinica Medica 101"} />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="apiKey">Brevo API key (nagsisimula sa xkeysib-) {brevo ? "(iwanang blangko para hindi palitan)" : ""}</label>
            <input id="apiKey" name="apiKey" type="text" className="input" autoComplete="off" spellCheck={false} style={{ WebkitTextSecurity: "disc" } as React.CSSProperties} data-1p-ignore data-lpignore="true" />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button className="btn">I-save ang Brevo</button>
            {brevo && <button className="btn-secondary" name="clear" value="1" formNoValidate>Alisin</button>}
          </div>
        </form>
      </section>

      {(cfg || brevo) && (
        <section className="card mb-4 space-y-2 text-sm">
          <h2>Subukan</h2>
          <form action={sendTestEmail} className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <label className="label" htmlFor="to">Ipadala ang test email sa</label>
              <input id="to" name="to" type="email" className="input" required placeholder="inyong personal na email" />
            </div>
            <button className="btn-secondary">Magpadala ng test</button>
          </form>
        </section>
      )}

      <section className="card space-y-1 text-sm">
        <h2>Kung ayaw gumana (GoDaddy Microsoft 365)</h2>
        <p>
          Kadalasang naka-off ang SMTP sa Microsoft 365 na binili sa GoDaddy. Kapag &quot;Naka-off ang SMTP&quot; ang error, kailangang i-on ang
          <b> Authenticated SMTP</b> para sa mailbox na ito sa Microsoft 365 admin center (Users → piliin ang mailbox → Mail → Manage email
          apps). Kung naka-on ang 2-step verification, gumawa ng <b>app password</b> at iyon ang ilagay dito.
        </p>
      </section>
    </>
  );
}
