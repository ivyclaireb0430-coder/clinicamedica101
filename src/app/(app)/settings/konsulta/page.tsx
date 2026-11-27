import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { aiApiKey } from "@/lib/messenger/ai-context";
import { consultDoctorName, loadConsultLessons } from "@/lib/consult/store";
import { BackLink, PageHeader } from "@/components/ui";
import { saveKonsultaSettings } from "./actions";

export default async function KonsultaSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requirePermission("settings:manage");
  const { saved, error } = await searchParams;
  const keys = ["consultEnabled", "consultDoctorName", "consultLicenseNo", "consultPtrNo", "consultS2No", "consultFeeNote", "consultDailyLimit", "consultUsage"] as const;
  const values = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSetting(k)] as const))) as Record<(typeof keys)[number], string>;
  const [hasKey, doctor, lessons] = await Promise.all([aiApiKey().then(Boolean), consultDoctorName(), loadConsultLessons()]);
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");

  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader title="Online konsulta settings" />
      {saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Na-save.</p>}
      {error === "consent" && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Para buksan sa mga pasyente, i-check muna na pumayag si {doctor} (pangalan at estilo niya ang gagamitin ng AI).</p>
      )}
      {!hasKey && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Wala pang AI API key. Ilagay muna sa <Link className="underline" href="/settings/messenger">Messenger settings</Link> (iisa ang key ng Messenger AI at ng online konsulta).
        </p>
      )}

      <section className="card mb-4 space-y-2 text-sm">
        <h2 className="font-semibold">Paano ito gumagana</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Sa <b>{base}/konsulta</b>, kakausapin ng pasyente ang AI assistant ni {doctor}. Malinaw sa kanila na AI ito at hindi si Doc mismo.</li>
          <li>Tatanungin ng AI ang history sa estilo ni Doc. Hindi ito magbibigay ng diagnosis, gamot, o dose (naka-block sa code).</li>
          <li>Emergency: hihinto ang AI, sasabihan ang pasyente na pumunta sa ER o tumawag sa 911, at ie-email si Doc.</li>
          <li>Pagpindot ng &quot;Ipadala kay Doc&quot;, gagawa ang AI ng summary at suggested plan sa <Link className="underline" href="/consults">Para kay Doc</Link>.</li>
          <li>Si Doc ang mag-e-edit at mag-a-approve ng sagot at e-reseta. Saka lang ito makikita ng pasyente (text/email link).</li>
        </ol>
        <p className="muted">Lahat ng chat ay naka-encrypt, naka-link sa lead ng pasyente (kasama sa privacy export at erasure), at naka-audit log.</p>
      </section>

      <form action={saveKonsultaSettings} className="card mb-4 space-y-3 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" name="consultEnabled" value="1" defaultChecked={values.consultEnabled === "1"} /> Bukas ang online konsulta sa mga pasyente
        </label>
        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2">
          <input type="checkbox" name="doctorConsent" className="mt-1" defaultChecked={values.consultEnabled === "1"} />
          <span>Kinukumpirma ko na pumayag si {doctor} na gamitin ang kanyang pangalan at estilo ng AI assistant, at siya ang magre-review ng bawat konsulta.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="consultDoctorName">Pangalan ng doktor</label>
            <input className="input" id="consultDoctorName" name="consultDoctorName" defaultValue={values.consultDoctorName} placeholder={doctor} maxLength={80} />
          </div>
          <div>
            <label className="label" htmlFor="consultDailyLimit">Max AI calls bawat araw</label>
            <input className="input" id="consultDailyLimit" name="consultDailyLimit" type="number" min={0} defaultValue={values.consultDailyLimit} />
            <p className="muted text-xs">Ngayong araw: {values.consultUsage.split(":")[1] ?? 0}</p>
          </div>
          <div>
            <label className="label" htmlFor="consultLicenseNo">PRC license no.</label>
            <input className="input" id="consultLicenseNo" name="consultLicenseNo" defaultValue={values.consultLicenseNo} maxLength={40} />
          </div>
          <div>
            <label className="label" htmlFor="consultPtrNo">PTR no.</label>
            <input className="input" id="consultPtrNo" name="consultPtrNo" defaultValue={values.consultPtrNo} maxLength={40} />
          </div>
          <div>
            <label className="label" htmlFor="consultS2No">S2 no. (optional)</label>
            <input className="input" id="consultS2No" name="consultS2No" defaultValue={values.consultS2No} maxLength={40} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="consultFeeNote">Fee note na makikita ng pasyente</label>
            <input className="input" id="consultFeeNote" name="consultFeeNote" defaultValue={values.consultFeeNote} maxLength={300} placeholder="Hal. Libre muna ang online konsulta ngayong Disyembre." />
          </div>
        </div>
        <button className="btn">Save</button>
      </form>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">Estilo ni {doctor}</h2>
        <p>
          Natutunan na ng AI: <b>{lessons.length}</b> aral.{" "}
          <Link className="text-brand-700 underline" href="/consults/train">Turuan si Doc AI</Link> sa pag-chat: i-paste ang sample replies ni Doc, ang mga tanong na lagi niyang
          tinatanong, at ang general advice niya.
        </p>
        <p className="muted">
          Link para sa pasyente: <code>{base}/konsulta</code>. Sa Messenger, lalabas ang &quot;Online konsulta&quot; button kapag bukas ito.
        </p>
      </section>
    </>
  );
}
