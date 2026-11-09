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
  return {
    title: name,
    description: headline,
    robots: { index: true, follow: true },
    icons: { icon: "/landing/logo.jpg" },
    openGraph: { title: name, description: headline, images: ["/landing/doctor.jpg"] },
  };
}

type SP = Record<string, string | string[] | undefined>;

// Small inline icons (no icon library in the project).
const Icon = {
  check: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  pin: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
  ),
  shield: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  steth: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M6 3v6a4 4 0 0 0 8 0V3" strokeLinecap="round" /><path d="M10 13v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></svg>
  ),
  chat: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z" strokeLinejoin="round" /></svg>
  ),
  arrow: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

function Leaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      <path d="M2 58C20 20 60 4 118 2 90 18 70 44 2 58z" fill="currentColor" />
    </svg>
  );
}

const redBtn =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-cm-red px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-cm-red/30 transition hover:bg-cm-redDark focus:outline-none focus:ring-4 focus:ring-cm-red/30";

export default async function LandingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const code = campaignCodeFrom(sp);
  const keys = [
    "landingEnabled", "clinicName", "clinicAddress", "landingHeadline", "landingSubheadline", "landingOffer", "landingPromoName", "landingPromoOldPrice", "landingPromoPrice", "landingPromoDesc", "landingBenefits",
    "landingFaq", "landingCta", "landingFeeNote", "landingShowFees", "landingShowTestimonials", "landingDoctorName", "landingDoctorTitle", "landingDoctorBio",
  ] as const;
  const [values, campaign] = await Promise.all([Promise.all(keys.map((k) => getSetting(k))), campaignByCode(code)]);
  const v = Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<(typeof keys)[number], string>;

  if (v.landingEnabled !== "1") {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card text-center text-sm">Salamat sa pagbisita! Mag-message po sa amin sa Facebook para sa inquiries.</div>
      </main>
    );
  }
  // Count the visit, but not a reload after a form error.
  if (!error) await recordLandingVisit(campaign?.id ?? null).catch(() => undefined);

  const [types, testimonials] = await Promise.all([
    v.landingShowFees === "1" ? db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }) : [],
    v.landingShowTestimonials === "1" ? publicTestimonials() : [],
  ]);
  const page = process.env.FB_PAGE_USERNAME;
  const messenger = page ? `https://m.me/${page}${code ? `?ref=${encodeURIComponent(code)}` : ""}` : null;
  const action = submitLandingInquiry.bind(null, campaign?.trackingCode ?? null);
  const benefits = lines(v.landingBenefits);
  const faq = parseFaq(v.landingFaq);
  const doctor = v.landingDoctorName;
  const promoPrice = Number(v.landingPromoPrice);
  const promoOld = Number(v.landingPromoOldPrice);
  const promo = v.landingPromoName ? { name: v.landingPromoName, price: promoPrice > 0 ? promoPrice : null, old: promoOld > promoPrice ? promoOld : null } : null;

  return (
    <div className="bg-white text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo.jpg" alt="Clinica Medica 101 logo" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-bold text-cm-blue">Clinica Medica 101</div>
              <div className="truncate text-xs text-slate-500">Center for Complementary Medicine</div>
            </div>
          </div>
          <a href="#form" className="hidden rounded-full bg-cm-red px-5 py-2 text-sm font-semibold text-white hover:bg-cm-redDark sm:inline-flex">Magpa-schedule</a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-cm-navy via-cm-blue to-[#0a73c2] text-white">
          <Leaf className="pointer-events-none absolute -right-10 bottom-0 w-72 text-cm-green/20" />
          <Leaf className="pointer-events-none absolute -left-16 top-10 w-56 -scale-x-100 text-white/5" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-8 md:grid-cols-[1.15fr_0.85fr] md:pb-20 md:pt-14">
            <div className="order-2 md:order-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
                <span className="h-2 w-2 rounded-full bg-cm-green" /> Tumatanggap ng bagong pasyente
              </span>
              <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{v.landingHeadline}</h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-50 sm:text-lg">{v.landingSubheadline}</p>
              {v.landingOffer && (
                <p className="mt-5 inline-flex items-start gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-cm-red shadow-lg">
                  <span aria-hidden="true">🎁</span>
                  {v.landingOffer}
                </p>
              )}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#form" className={redBtn}>{v.landingCta} {Icon.arrow()}</a>
                {messenger && (
                  <a href={messenger} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-6 py-3.5 font-semibold ring-1 ring-white/40 hover:bg-white/20">
                    {Icon.chat()} Mag-message sa Messenger
                  </a>
                )}
              </div>
              <ul className="mt-7 grid gap-2 text-sm text-blue-50 sm:grid-cols-2">
                <li className="flex items-center gap-2">{Icon.steth("h-5 w-5 text-cm-green")} Personal na consultation kay {doctor}</li>
                <li className="flex items-center gap-2">{Icon.pin("h-5 w-5 text-cm-green")} Centuria Medical Makati</li>
                <li className="flex items-center gap-2">{Icon.shield("h-5 w-5 text-cm-green")} Kumpidensyal ang inyong records</li>
                <li className="flex items-center gap-2">{Icon.check("h-5 w-5 text-cm-green")} Malinaw ang fees bago mag-book</li>
              </ul>
            </div>
            <div className="order-1 flex justify-center md:order-2">
              <figure className="relative">
                <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-cm-green via-white/60 to-cm-red opacity-80 blur-[2px]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/doctor.jpg"
                  alt={doctor}
                  width={320}
                  height={320}
                  className="relative h-40 w-40 rounded-full border-[6px] border-white object-cover shadow-2xl sm:h-72 sm:w-72"
                />
                <figcaption className="absolute -bottom-4 left-1/2 w-max -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-cm-navy shadow-lg">
                  {doctor}
                </figcaption>
              </figure>
            </div>
          </div>
          <svg viewBox="0 0 1440 60" className="block w-full text-white" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60V30C240 0 480 0 720 25s480 35 720 5v30H0z" fill="currentColor" />
          </svg>
        </section>

        {/* Benefits */}
        {benefits.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-12">
            <p className="text-center text-sm font-semibold uppercase tracking-wider text-cm-green">Bakit Clinica Medica 101</p>
            <h2 className="mt-1 text-center text-2xl font-bold text-cm-navy sm:text-3xl">Alaga na nakatutok sa inyo</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((b) => (
                <li key={b} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cm-mint text-cm-green">{Icon.check()}</span>
                  <p className="mt-3 font-medium text-slate-800">{b}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Featured promo */}
        {promo && (
          <section className="mx-auto max-w-6xl px-4 pb-12">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cm-red to-cm-redDark p-6 text-white shadow-xl sm:p-10">
              <Leaf className="pointer-events-none absolute -right-8 -top-4 w-64 text-white/10" />
              <div className="relative grid items-center gap-6 md:grid-cols-[1.3fr_1fr]">
                <div>
                  <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-cm-red">Promo ngayon</span>
                  <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">{promo.name}</h2>
                  <p className="mt-3 max-w-xl leading-relaxed text-red-50">{v.landingPromoDesc}</p>
                </div>
                <div className="rounded-2xl bg-white p-6 text-center text-slate-800 shadow-lg">
                  {promo.old && <div className="text-lg text-slate-400 line-through">{formatPhp(promo.old)}</div>}
                  {promo.price && <div className="text-5xl font-extrabold text-cm-red">{formatPhp(promo.price)}</div>}
                  {promo.old && promo.price && (
                    <div className="mt-1 text-sm font-semibold text-cm-green">Tipid {formatPhp(promo.old - promo.price)}</div>
                  )}
                  <div className="mt-1 text-xs text-slate-500">+ consultation fee</div>
                  <a href="#form" className={`${redBtn} mt-4 w-full`}>I-avail ang promo</a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Doctor */}
        <section className="bg-cm-sky">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[auto_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/doctor.jpg" alt={doctor} width={220} height={220} className="mx-auto h-44 w-44 rounded-3xl object-cover shadow-xl ring-4 ring-white md:h-56 md:w-56" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-cm-green">Kilalanin ang inyong doktor</p>
              <h2 className="mt-1 text-2xl font-bold text-cm-navy sm:text-3xl">{doctor}</h2>
              <p className="text-sm text-slate-600">{v.landingDoctorTitle}</p>
              <p className="mt-4 max-w-2xl leading-relaxed text-slate-700">{v.landingDoctorBio}</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">Madali lang magpa-schedule</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Mag-fill up ng form", "Isang minuto lang. Pangalan, mobile number, at kung kailan kayo libre."],
              ["Kokontakin namin kayo", "Tatawagan o ite-text kayo ng aming front desk para sa schedule at fees."],
              [`Consultation kay ${doctor}`, "Pupunta kayo sa clinic sa Centuria Medical Makati sa napagkasunduang oras."],
            ].map(([title, body], i) => (
              <li key={title} className="relative rounded-2xl border border-slate-100 p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cm-blue text-lg font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold text-cm-navy">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Fees */}
        {types.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-12">
            <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">Consultation at fees</h2>
            <p className="mt-1 text-center text-sm text-slate-500">Walang sorpresa. Ito ang babayaran ninyo sa consultation.</p>
            <ul className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2">
              {types.map((t) => (
                <li key={t.id} className="flex flex-col rounded-2xl border-2 border-cm-blue/15 bg-white p-5 shadow-sm">
                  <div className="font-semibold text-cm-navy">{t.name}</div>
                  {t.description && <div className="mt-1 text-sm text-slate-600">{t.description}</div>}
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-sm text-slate-500">{t.durationMin} minuto</span>
                    <span className="text-2xl font-extrabold text-cm-blue">{formatPhp(t.feePhp)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {v.landingFeeNote && (
              <p className="mx-auto mt-4 flex max-w-4xl items-start gap-2 rounded-2xl bg-cm-mint px-4 py-3 text-sm font-medium text-cm-navy">
                {Icon.check("h-5 w-5 shrink-0 text-cm-green")} {v.landingFeeNote}
              </p>
            )}
          </section>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <section className="bg-gradient-to-b from-white to-cm-mint/60">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">Sabi ng aming mga pasyente</h2>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((t, i) => (
                  <li key={i} className="flex flex-col rounded-2xl bg-white p-5 shadow-md">
                    <div className="text-lg tracking-wider text-amber-400" aria-label={`${t.rating} stars`}>{"★".repeat(t.rating)}</div>
                    <p className="mt-2 flex-1 leading-relaxed text-slate-700">“{t.text}”</p>
                    <p className="mt-4 text-sm font-semibold text-cm-navy">{t.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Form */}
        <section id="form" className="scroll-mt-16 bg-gradient-to-br from-cm-navy to-cm-blue">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[0.9fr_1.1fr] md:items-start">
            <div className="text-white">
              <h2 className="text-3xl font-extrabold leading-tight">{v.landingCta}</h2>
              <p className="mt-3 text-blue-50">Libre ang mag-inquire. Kokontakin kayo ng aming front desk para sa schedule, karaniwan sa loob ng isang araw.</p>
              <ul className="mt-6 space-y-3 text-sm text-blue-50">
                <li className="flex gap-2">{Icon.shield("h-5 w-5 shrink-0 text-cm-green")} Si {doctor} lang ang makakabasa ng inyong health concern.</li>
                <li className="flex gap-2">{Icon.pin("h-5 w-5 shrink-0 text-cm-green")} {v.clinicAddress}</li>
              </ul>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
              {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <form action={action} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className="label">Pangalan *</span><input className="input" name="firstName" required maxLength={80} autoComplete="given-name" /></label>
                  <label><span className="label">Apelyido</span><input className="input" name="lastName" maxLength={80} autoComplete="family-name" /></label>
                  <label><span className="label">Mobile number *</span><input className="input" name="mobile" required inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" /></label>
                  <label><span className="label">Email (optional)</span><input className="input" name="email" type="email" autoComplete="email" /></label>
                </div>
                <label className="block">
                  <span className="label">Ano po ang inyong iniinda? (optional)</span>
                  <textarea className="input" name="concern" rows={3} maxLength={300} placeholder="Hal. matagal nang sakit ng ulo, hirap matulog…" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
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
                {promo && (
                  <label className="flex items-start gap-2.5 rounded-xl border-2 border-cm-red/20 bg-red-50/50 p-3 text-sm">
                    <input type="checkbox" name="promoInterest" defaultChecked className="mt-0.5 h-4 w-4 accent-cm-red" />
                    <span>Interesado ako sa <b>{promo.name}</b> promo{promo.price ? ` (${formatPhp(promo.price)})` : ""}</span>
                  </label>
                )}
                {/* Honeypot for bots: hidden from people and screen readers. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
                  <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                </div>
                <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-sm">
                  <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-cm-blue" />
                  <span>
                    Pumapayag ako na gamitin ng clinic ang impormasyong ito para kontakin ako at i-schedule ang aking consultation, ayon sa{" "}
                    <Link href="/privacy" className="font-medium text-cm-blue underline" target="_blank">Privacy Notice</Link>.
                  </span>
                </label>
                <button className={`${redBtn} w-full`}>Ipadala ang inquiry {Icon.arrow()}</button>
              </form>
            </div>
          </div>
        </section>

        {/* FAQ */}
        {faq.length > 0 && (
          <section className="mx-auto max-w-3xl px-4 py-12">
            <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">Mga madalas itanong</h2>
            <div className="mt-6 space-y-3">
              {faq.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-4 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-cm-navy">
                    {f.q}
                    <span className="text-xl text-cm-blue transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-slate-700">{f.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-8 text-center">
              <a href="#form" className={redBtn}>{v.landingCta} {Icon.arrow()}</a>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-cm-navy pb-24 pt-10 text-sm text-blue-100 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/logo.jpg" alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
          <div className="font-semibold text-white">{v.clinicName}</div>
          <div>{v.clinicAddress}</div>
          <Link href="/privacy" className="underline">Privacy Notice</Link>
        </div>
      </footer>

      {/* Sticky call to action on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
        <a href="#form" className={`${redBtn} w-full py-3`}>{v.landingCta}</a>
      </div>
    </div>
  );
}
