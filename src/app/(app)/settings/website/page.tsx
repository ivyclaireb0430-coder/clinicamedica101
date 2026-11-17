import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { parseServices } from "@/lib/site-content";
import { BackLink, PageHeader } from "@/components/ui";
import { saveWebsiteSettings } from "../actions";

const KEYS = ["siteEnabled", "siteHeadline", "siteHeadlineEn", "siteIntro", "siteIntroEn", "siteServices", "siteServicesEn"] as const;

export default async function WebsiteSettings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const v = Object.fromEntries(await Promise.all(KEYS.map(async (k) => [k, await getSetting(k)] as const))) as Record<(typeof KEYS)[number], string>;
  const appUrl = process.env.APP_URL ?? "";
  const count = { tl: parseServices(v.siteServices).length, en: parseServices(v.siteServicesEn).length };

  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader
        title="Website"
        subtitle="Ang public website ng clinic: services, doktor, fees, location at oras. Ang mga Book button ay papunta sa booking form ng landing pages."
        action={<Link href="/clinic" target="_blank" className="btn-secondary">Tingnan ang website ↗</Link>}
      />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}

      <section className="card mb-4 space-y-2 text-sm">
        <h2>Address ng website</h2>
        <div><span className="label">Taglish</span><code className="block break-all text-xs">{appUrl}/clinic</code></div>
        <div><span className="label">English</span><code className="block break-all text-xs">{appUrl}/clinic/en</code></div>
        <p className="muted text-xs">
          Ang doktor, bio, contact number, clinic hours, promo at FAQ ay galing sa <Link href="/settings/landing" className="text-brand-700 underline">Landing page settings</Link>.
          Ang consultation fees ay galing sa <Link href="/settings/schedule" className="text-brand-700 underline">Schedule, fees & closed dates</Link>.
        </p>
        <p className="muted text-xs">
          Ang mga nag-book galing sa website ay may tracking code na <code>website</code>. Para makita sila nang hiwalay sa Dashboard, gumawa ng campaign na may
          tracking code na <code>website</code> sa <Link href="/settings/campaigns" className="text-brand-700 underline">Campaigns & tracking links</Link>.
        </p>
      </section>

      <form action={saveWebsiteSettings} className="card space-y-3 text-sm">
        <h2>Laman ng website</h2>
        <label className="flex items-center gap-2"><input type="checkbox" name="siteEnabled" defaultChecked={v.siteEnabled === "1"} /> Naka-on ang website</label>
        <label className="block"><span className="label">Headline (Taglish)</span><input className="input" name="siteHeadline" maxLength={200} required defaultValue={v.siteHeadline} /></label>
        <label className="block"><span className="label">Intro (Taglish)</span><textarea className="input" name="siteIntro" rows={3} maxLength={600} defaultValue={v.siteIntro} /></label>
        <label className="block">
          <span className="label">Services (Taglish), {count.tl} ngayon. Isa bawat linya: Pangalan | Paliwanag | link</span>
          <textarea className="input font-mono text-xs" name="siteServices" rows={8} maxLength={5000} defaultValue={v.siteServices} />
        </label>
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 font-medium">English (para sa /clinic/en)</legend>
          <label className="block"><span className="label">Headline</span><input className="input" name="siteHeadlineEn" maxLength={200} required defaultValue={v.siteHeadlineEn} /></label>
          <label className="block"><span className="label">Intro</span><textarea className="input" name="siteIntroEn" rows={3} maxLength={600} defaultValue={v.siteIntroEn} /></label>
          <label className="block">
            <span className="label">Services, {count.en} now. One per line: Name | Description | link</span>
            <textarea className="input font-mono text-xs" name="siteServicesEn" rows={8} maxLength={5000} defaultValue={v.siteServicesEn} />
          </label>
        </fieldset>
        <p className="muted text-xs">
          Ang <b>link</b> ang page na bubukas sa Book button ng service: <code>consultation</code>, <code>vector-scan</code>, o <code>start</code> (general page).
          Kapag blangko, consultation. Halimbawa: <code>Vector Scan | Non-invasive na scan... | vector-scan</code>
        </p>
        <p className="muted text-xs">
          Paalala: iwasan ang mga pangakong &quot;gagaling&quot;, &quot;cure&quot; o &quot;guaranteed&quot;. Hindi ito pinapayagan ng FDA/DOH rules sa health advertising.
        </p>
        <button className="btn">Save</button>
      </form>
    </>
  );
}
