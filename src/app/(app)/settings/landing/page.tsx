import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { addDays, manilaToUtc, todayManila } from "@/lib/time";
import { landingVisits } from "@/lib/funnel-db";
import { LANDING_PAGES, LANDING_PAGE_LABELS, pagePath } from "@/lib/landing-content";
import { BackLink, PageHeader } from "@/components/ui";
import { saveLandingSettings } from "../actions";

const KEYS = [
  "landingEnabled", "landingHeadline", "landingSubheadline", "landingOffer", "landingPromoName", "landingPromoOldPrice", "landingPromoPrice", "landingPromoDesc", "landingBenefits", "landingFaq",
  "landingCta", "landingFeeNote", "landingShowFees", "landingShowTestimonials", "landingDoctorName", "landingDoctorTitle", "landingDoctorBio",
  "landingDoctorBioEn", "landingPromoDescEn", "landingFeeNoteEn", "clinicPhone", "clinicHours", "clinicHoursEn",
] as const;

export default async function LandingSettings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const v = Object.fromEntries(await Promise.all(KEYS.map(async (k) => [k, await getSetting(k)] as const))) as Record<(typeof KEYS)[number], string>;
  const today = todayManila();
  const from = addDays(today, -29);
  const [visits, byPageLeads, campaigns] = await Promise.all([
    landingVisits(from, today),
    db.lead.groupBy({ by: ["landingPage"], where: { source: "WEBSITE", firstContactAt: { gte: manilaToUtc(from, "00:00") } }, _count: true }),
    db.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, trackingCode: true } }),
  ]);
  const appUrl = process.env.APP_URL ?? "";
  const leadsFor = (page: string) => byPageLeads.find((r) => (r.landingPage ?? "start") === page)?._count ?? 0;
  const inquiries = byPageLeads.reduce((s, r) => s + r._count, 0);

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
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="py-1">Page</th><th className="text-right">Visits</th><th className="text-right">Inquiries</th><th className="text-right">Conversion</th></tr></thead>
          <tbody>
            {LANDING_PAGES.map((p) => {
              const vis = visits.byPage.get(p) ?? 0;
              const inq = leadsFor(p);
              return (
                <tr key={p} className="border-t border-slate-100">
                  <td className="py-1.5"><Link href={pagePath(p)} target="_blank" className="text-brand-700 hover:underline">{LANDING_PAGE_LABELS[p]}</Link></td>
                  <td className="text-right">{vis}</td>
                  <td className="text-right">{inq}</td>
                  <td className="text-right">{vis > 0 ? `${Math.round((inq / vis) * 100)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted mt-2 text-xs">Kumpletong funnel per campaign (booked, nag-consult, kita) ay nasa Dashboard.</p>
      </section>

      <section className="card mb-4 space-y-2 text-sm">
        <h2>Links para sa ads</h2>
        <p className="muted">Gamitin ang link ng campaign sa ad para makita kung saang ad galing ang bawat pasyente.</p>
        <div className="space-y-1">
          {LANDING_PAGES.map((p) => (
            <div key={p}><span className="label">{LANDING_PAGE_LABELS[p]}</span><code className="block break-all text-xs">{appUrl}{pagePath(p)}</code></div>
          ))}
        </div>
        {campaigns.length > 0 && (
          <p className="pt-2">
            Para sa isang campaign, idagdag ang <code>?c=&lt;tracking code&gt;</code> sa dulo ng link. Halimbawa:{" "}
            <code className="break-all text-xs">{appUrl}/start/vector-scan?c={campaigns[0].trackingCode}</code>. Mga code:{" "}
            {campaigns.map((c) => <span key={c.id} className="badge mr-1">{c.trackingCode}</span>)}
          </p>
        )}
        <p className="muted text-xs">
          Sa Facebook Ads Manager, pwede ring ilagay sa URL parameters: <code>utm_campaign=&lt;tracking code&gt;</code>. Gumawa ng
          bagong campaign sa <Link href="/settings/campaigns" className="text-brand-700 underline">Campaigns & tracking links</Link>.
          Ang thank-you page ay <code>/start/salamat</code> (gamitin para sa &quot;Lead&quot; conversion sa ads).
        </p>
      </section>

      <form action={saveLandingSettings} className="card space-y-3 text-sm">
        <h2>Laman ng page</h2>
        <p className="muted text-xs">Ang headline, offer, benefits at FAQ dito ay para sa general page (/start). Ang Vector Scan at Consultation pages ay may sariling nakasulat na Taglish at English na text, pero dito pa rin kinukuha ang doktor, promo prices at fees.</p>
        <label className="flex items-center gap-2"><input type="checkbox" name="landingEnabled" defaultChecked={v.landingEnabled === "1"} /> Naka-on ang landing page</label>
        <label className="block"><span className="label">Headline</span><input className="input" name="landingHeadline" maxLength={200} required defaultValue={v.landingHeadline} /></label>
        <label className="block"><span className="label">Sub-headline</span><textarea className="input" name="landingSubheadline" rows={2} maxLength={500} defaultValue={v.landingSubheadline} /></label>
        <label className="block"><span className="label">Offer / promo (optional, naka-highlight)</span><input className="input" name="landingOffer" maxLength={200} defaultValue={v.landingOffer} placeholder="Hal. ₱500 off sa first consultation ngayong Nobyembre" /></label>
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 font-medium">Featured promo (iwanang blangko ang pangalan para itago)</legend>
          <label className="block"><span className="label">Pangalan ng service</span><input className="input" name="landingPromoName" maxLength={80} defaultValue={v.landingPromoName} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Dating presyo (₱)</span><input className="input" name="landingPromoOldPrice" type="number" min={0} defaultValue={v.landingPromoOldPrice} /></label>
            <label className="block"><span className="label">Promo price (₱)</span><input className="input" name="landingPromoPrice" type="number" min={0} defaultValue={v.landingPromoPrice} /></label>
          </div>
          <label className="block"><span className="label">Description</span><textarea className="input" name="landingPromoDesc" rows={3} maxLength={600} defaultValue={v.landingPromoDesc} /></label>
        </fieldset>
        <label className="block"><span className="label">Bakit kami (isa bawat linya)</span><textarea className="input" name="landingBenefits" rows={5} maxLength={1500} defaultValue={v.landingBenefits} /></label>
        <label className="block"><span className="label">FAQ (isa bawat linya: Tanong | Sagot)</span><textarea className="input font-mono text-xs" name="landingFaq" rows={6} maxLength={4000} defaultValue={v.landingFaq} /></label>
        <label className="block"><span className="label">Contact number ng clinic (tap-to-call sa page; blank = itago)</span><input className="input" name="clinicPhone" maxLength={30} inputMode="tel" defaultValue={v.clinicPhone} /></label>
        <label className="block"><span className="label">Clinic hours (text lang na ipinapakita; ang online booking slots ay galing sa Schedule settings)</span><input className="input" name="clinicHours" maxLength={200} defaultValue={v.clinicHours} /></label>
        <label className="block"><span className="label">Pangalan ng doktor</span><input className="input" name="landingDoctorName" maxLength={80} required defaultValue={v.landingDoctorName} /></label>
        <label className="block"><span className="label">Title / specialty ng doktor</span><input className="input" name="landingDoctorTitle" maxLength={150} defaultValue={v.landingDoctorTitle} /></label>
        <label className="block"><span className="label">Tungkol sa doktor</span><textarea className="input" name="landingDoctorBio" rows={4} maxLength={1200} defaultValue={v.landingDoctorBio} /></label>
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 font-medium">English versions (para sa /en pages)</legend>
          <label className="block"><span className="label">About the doctor</span><textarea className="input" name="landingDoctorBioEn" rows={3} maxLength={1200} defaultValue={v.landingDoctorBioEn} /></label>
          <label className="block"><span className="label">Promo description</span><textarea className="input" name="landingPromoDescEn" rows={3} maxLength={600} defaultValue={v.landingPromoDescEn} /></label>
          <label className="block"><span className="label">Clinic hours</span><input className="input" name="clinicHoursEn" maxLength={200} defaultValue={v.clinicHoursEn} /></label>
          <label className="block"><span className="label">Fee note (Senior/PWD)</span><input className="input" name="landingFeeNoteEn" maxLength={250} defaultValue={v.landingFeeNoteEn} /></label>
        </fieldset>
        <label className="block"><span className="label">Button text</span><input className="input" name="landingCta" maxLength={60} required defaultValue={v.landingCta} /></label>
        <label className="block"><span className="label">Paalala sa ilalim ng fees (hal. Senior/PWD rate)</span><input className="input" name="landingFeeNote" maxLength={250} defaultValue={v.landingFeeNote} /></label>
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
