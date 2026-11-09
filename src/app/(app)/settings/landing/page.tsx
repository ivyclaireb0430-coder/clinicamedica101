import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { addDays, manilaToUtc, todayManila } from "@/lib/time";
import { landingVisits } from "@/lib/funnel-db";
import { BackLink, PageHeader } from "@/components/ui";
import { saveLandingSettings } from "../actions";

const KEYS = [
  "landingEnabled", "landingHeadline", "landingSubheadline", "landingOffer", "landingBenefits", "landingFaq",
  "landingCta", "landingShowFees", "landingShowTestimonials",
] as const;

export default async function LandingSettings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const v = Object.fromEntries(await Promise.all(KEYS.map(async (k) => [k, await getSetting(k)] as const))) as Record<(typeof KEYS)[number], string>;
  const today = todayManila();
  const from = addDays(today, -29);
  const [visits, inquiries, campaigns] = await Promise.all([
    landingVisits(from, today),
    db.lead.count({ where: { source: "WEBSITE", firstContactAt: { gte: manilaToUtc(from, "00:00") } } }),
    db.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, trackingCode: true } }),
  ]);
  const base = `${process.env.APP_URL ?? ""}/start`;

  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader
        title="Landing page (sales funnel)"
        subtitle="Ang public page na pupuntahan ng mga tao galing sa ads. Bawat form ay papasok sa Leads bilang New inquiry."
        action={<Link href="/start" target="_blank" className="btn-secondary">Tingnan ang page ↗</Link>}
      />
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved.</p>}

      <section className="card mb-4 text-sm">
        <h2>Last 30 days</h2>
        <p className="mt-1">
          <b>{visits.total}</b> page visits → <b>{inquiries}</b> web form inquiries
          {visits.total > 0 && <> (<b>{Math.round((inquiries / visits.total) * 100)}%</b> conversion)</>}
        </p>
        <p className="muted text-xs">Kumpletong funnel per campaign (booked, nag-consult, kita) ay nasa Dashboard.</p>
      </section>

      <section className="card mb-4 space-y-2 text-sm">
        <h2>Links para sa ads</h2>
        <p className="muted">Gamitin ang link ng campaign sa ad para makita kung saang ad galing ang bawat pasyente.</p>
        <div><span className="label">Walang campaign</span><code className="block break-all text-xs">{base}</code></div>
        {campaigns.map((c) => (
          <div key={c.id}>
            <span className="label">{c.name}</span>
            <code className="block break-all text-xs">{base}?c={c.trackingCode}</code>
          </div>
        ))}
        <p className="muted text-xs">
          Sa Facebook Ads Manager, pwede ring ilagay sa URL parameters: <code>utm_campaign=&lt;tracking code&gt;</code>. Gumawa ng
          bagong campaign sa <Link href="/settings/campaigns" className="text-brand-700 underline">Campaigns & tracking links</Link>.
          Ang thank-you page ay <code>/start/salamat</code> (gamitin para sa &quot;Lead&quot; conversion sa ads).
        </p>
      </section>

      <form action={saveLandingSettings} className="card space-y-3 text-sm">
        <h2>Laman ng page</h2>
        <label className="flex items-center gap-2"><input type="checkbox" name="landingEnabled" defaultChecked={v.landingEnabled === "1"} /> Naka-on ang landing page</label>
        <label className="block"><span className="label">Headline</span><input className="input" name="landingHeadline" maxLength={200} required defaultValue={v.landingHeadline} /></label>
        <label className="block"><span className="label">Sub-headline</span><textarea className="input" name="landingSubheadline" rows={2} maxLength={500} defaultValue={v.landingSubheadline} /></label>
        <label className="block"><span className="label">Offer / promo (optional, naka-highlight)</span><input className="input" name="landingOffer" maxLength={200} defaultValue={v.landingOffer} placeholder="Hal. ₱500 off sa first consultation ngayong Nobyembre" /></label>
        <label className="block"><span className="label">Bakit kami (isa bawat linya)</span><textarea className="input" name="landingBenefits" rows={5} maxLength={1500} defaultValue={v.landingBenefits} /></label>
        <label className="block"><span className="label">FAQ (isa bawat linya: Tanong | Sagot)</span><textarea className="input font-mono text-xs" name="landingFaq" rows={6} maxLength={4000} defaultValue={v.landingFaq} /></label>
        <label className="block"><span className="label">Button text</span><input className="input" name="landingCta" maxLength={60} required defaultValue={v.landingCta} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="landingShowFees" defaultChecked={v.landingShowFees === "1"} /> Ipakita ang consultation types at fees (galing sa Schedule settings)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="landingShowTestimonials" defaultChecked={v.landingShowTestimonials === "1"} /> Ipakita ang testimonials (4–5 stars lang, may pahintulot ng pasyente, hindi naka-hide)</label>
        <p className="muted text-xs">
          Paalala: iwasan ang mga pangakong &quot;gagaling&quot; o &quot;cure&quot; sa headline at offer. Hindi ito pinapayagan ng Facebook ads at ng FDA/DOH rules sa health advertising.
        </p>
        <button className="btn">Save</button>
      </form>
    </>
  );
}
