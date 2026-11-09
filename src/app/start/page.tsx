import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { formatPhp } from "@/lib/time";
import { CONTACT_METHODS, PREFERRED_TIMES, campaignCodeFrom, lines, parseFaq } from "@/lib/funnel";
import { campaignByCode, publicTestimonials, recordLandingVisit } from "@/lib/funnel-db";
import { submitLandingInquiry } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [name, headline] = await Promise.all([getSetting("clinicName"), getSetting("landingHeadline")]);
  return { title: `${name}`, description: headline, robots: { index: true, follow: true } };
}

type SP = Record<string, string | string[] | undefined>;

export default async function LandingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const code = campaignCodeFrom(sp);
  const [enabled, name, address, headline, sub, offer, benefits, faq, cta, showFees, showTestimonials, campaign] = await Promise.all([
    getSetting("landingEnabled"), getSetting("clinicName"), getSetting("clinicAddress"), getSetting("landingHeadline"),
    getSetting("landingSubheadline"), getSetting("landingOffer"), getSetting("landingBenefits"), getSetting("landingFaq"),
    getSetting("landingCta"), getSetting("landingShowFees"), getSetting("landingShowTestimonials"), campaignByCode(code),
  ]);
  if (enabled !== "1") {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card text-center text-sm">Salamat sa pagbisita! Mag-message po sa amin sa Facebook para sa inquiries.</div>
      </main>
    );
  }
  // Count the visit, but not a reload after a form error.
  if (!error) await recordLandingVisit(campaign?.id ?? null).catch(() => undefined);

  const [types, testimonials] = await Promise.all([
    showFees === "1" ? db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }) : [],
    showTestimonials === "1" ? publicTestimonials() : [],
  ]);
  const page = process.env.FB_PAGE_USERNAME;
  const messenger = page ? `https://m.me/${page}${code ? `?ref=${encodeURIComponent(code)}` : ""}` : null;
  const action = submitLandingInquiry.bind(null, campaign?.trackingCode ?? null);

  return (
    <main className="bg-white">
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 pb-10 pt-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-brand-700">{name}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{headline}</h1>
          <p className="mt-4 text-base text-slate-700">{sub}</p>
          {offer && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">{offer}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#form" className="btn px-6 py-3 text-base">{cta}</a>
            {messenger && <a href={messenger} className="btn-secondary px-6 py-3 text-base">Mag-message sa Messenger</a>}
          </div>
          <p className="muted mt-3">📍 {address}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-10 px-4 pb-16">
        {lines(benefits).length > 0 && (
          <section>
            <h2 className="mb-3 text-xl">Bakit Clinica Medica 101?</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {lines(benefits).map((b) => (
                <li key={b} className="card flex gap-2 text-sm"><span className="text-brand-600">✓</span>{b}</li>
              ))}
            </ul>
          </section>
        )}

        {types.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl">Consultation at fees</h2>
            <ul className="space-y-2">
              {types.map((t) => (
                <li key={t.id} className="card flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="muted">{t.description}</div>}
                    <div className="muted">{t.durationMin} minuto</div>
                  </div>
                  <b className="whitespace-nowrap">{formatPhp(t.feePhp)}</b>
                </li>
              ))}
            </ul>
          </section>
        )}

        {testimonials.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl">Sabi ng aming mga pasyente</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {testimonials.map((t, i) => (
                <li key={i} className="card text-sm">
                  <div className="text-amber-400">{"★".repeat(t.rating)}</div>
                  <p className="mt-1">“{t.text}”</p>
                  <p className="muted mt-2">— {t.name}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="form" className="scroll-mt-4">
          <h2 className="text-xl">{cta}</h2>
          <p className="muted mb-3">Tatawagan o ite-text kayo ng aming front desk para sa schedule. Libre ang mag-inquire.</p>
          {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <form action={action} className="card space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">Pangalan *</span><input className="input" name="firstName" required maxLength={80} autoComplete="given-name" /></label>
              <label><span className="label">Apelyido</span><input className="input" name="lastName" maxLength={80} autoComplete="family-name" /></label>
              <label><span className="label">Mobile number *</span><input className="input" name="mobile" required inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" /></label>
              <label><span className="label">Email (optional)</span><input className="input" name="email" type="email" autoComplete="email" /></label>
            </div>
            <label className="block">
              <span className="label">Ano po ang inyong iniinda? (optional)</span>
              <textarea className="input" name="concern" rows={3} maxLength={300} placeholder="Hal. matagal nang sakit ng ulo, hirap matulog…" />
              <span className="muted text-xs">Ang doktor lang ang makakabasa nito.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">Kailan kayo libre?</span>
                <select className="input" name="preferredTime" defaultValue="ANY">
                  {PREFERRED_TIMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label><span className="label">Paano namin kayo kokontakin?</span>
                <select className="input" name="contactMethod" defaultValue="CALL">
                  {CONTACT_METHODS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
            </div>
            {/* Honeypot for bots: hidden from people and screen readers. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
              <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>
                Pumapayag ako na gamitin ng clinic ang impormasyong ito para kontakin ako at i-schedule ang aking consultation, ayon sa{" "}
                <Link href="/privacy" className="text-brand-700 underline" target="_blank">Privacy Notice</Link>.
              </span>
            </label>
            <button className="btn w-full py-3 text-base">Ipadala</button>
          </form>
        </section>

        {parseFaq(faq).length > 0 && (
          <section>
            <h2 className="mb-3 text-xl">Mga madalas itanong</h2>
            <div className="space-y-2">
              {parseFaq(faq).map((f) => (
                <details key={f.q} className="card text-sm">
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-slate-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <footer className="muted border-t pt-4 text-xs">
          {name} · {address} · <Link href="/privacy" className="underline">Privacy Notice</Link>
        </footer>
      </div>
    </main>
  );
}
