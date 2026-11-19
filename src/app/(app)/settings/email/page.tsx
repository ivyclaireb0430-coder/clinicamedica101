import { requirePermission } from "@/lib/session";
import { BackLink, PageHeader } from "@/components/ui";
import { SMTP_PRESETS, loadSmtp } from "@/lib/email";
import { saveSmtpSettings, sendTestEmail } from "../actions";

export default async function EmailSettings({ searchParams }: { searchParams: Promise<{ saved?: string; test?: string; error?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const cfg = await loadSmtp();
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
        <div>Status: <b>{cfg ? `Naka-set: ${cfg.user} (${cfg.host})` : "Hindi pa naka-set"}</b></div>
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

      {cfg && (
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
