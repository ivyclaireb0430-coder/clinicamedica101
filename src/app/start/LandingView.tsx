import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting, type SettingKey } from "@/lib/settings";
import { formatPhp } from "@/lib/time";
import { CONTACT_METHODS, PREFERRED_TIMES, campaignCodeFrom, telHref } from "@/lib/funnel";
import { bookableDays, campaignByCode, publicTestimonials, recordLandingVisit, webBookingType } from "@/lib/funnel-db";
import { SlotPicker } from "./SlotPicker";
import { UI, pageLang, type FunnelCopy, type LandingPageId } from "@/lib/landing-content";
import { submitLandingInquiry } from "./actions";

export type SP = Record<string, string | string[] | undefined>;

const BASE_KEYS = [
  "landingEnabled", "clinicName", "clinicAddress", "clinicPhone", "clinicHours", "clinicHoursEn", "landingDoctorName", "landingDoctorTitle", "landingDoctorBio", "landingDoctorBioEn",
  "landingPromoName", "landingPromoOldPrice", "landingPromoPrice", "landingPromoDesc", "landingPromoDescEn", "landingFeeNote",
  "landingFeeNoteEn", "landingShowFees", "landingShowTestimonials",
] as const satisfies readonly SettingKey[];

export type LandingBase = Record<(typeof BASE_KEYS)[number], string> & {
  promo: { name: string; price: number | null; old: number | null } | null;
};

/** Settings shared by every landing page. */
export async function loadLandingBase(): Promise<LandingBase> {
  const values = await Promise.all(BASE_KEYS.map((k) => getSetting(k)));
  const v = Object.fromEntries(BASE_KEYS.map((k, i) => [k, values[i]])) as Record<(typeof BASE_KEYS)[number], string>;
  const price = Number(v.landingPromoPrice);
  const old = Number(v.landingPromoOldPrice);
  return {
    ...v,
    promo: v.landingPromoName ? { name: v.landingPromoName, price: price > 0 ? price : null, old: old > price ? old : null } : null,
  };
}

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
  phone: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" strokeLinejoin="round" /></svg>
  ),
  clock: (c = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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

export function messengerLink(code: string | null) {
  const page = process.env.FB_PAGE_USERNAME;
  return page ? `https://m.me/${page}${code ? `?ref=${encodeURIComponent(code)}` : ""}` : null;
}

export async function LandingView({
  pageId, sp, base, copy, showPromo, promoFirst = false, crossLink,
}: {
  pageId: LandingPageId;
  sp: SP;
  base: LandingBase;
  copy: FunnelCopy;
  showPromo: boolean;
  /** Put the promo section right after the hero (the Vector Scan funnel). */
  promoFirst?: boolean;
  crossLink?: { text: string; label: string; href: string };
}) {
  const lang = pageLang(pageId);
  const t = UI[lang];
  const en = lang === "en";
  const error = typeof sp.error === "string" ? sp.error : null;
  const code = campaignCodeFrom(sp);
  const campaign = await campaignByCode(code);

  if (base.landingEnabled !== "1") {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card text-center text-sm">{t.off}</div>
      </main>
    );
  }
  // Count the visit, but not a reload after a form error.
  if (!error) await recordLandingVisit(campaign?.id ?? null, pageId).catch(() => undefined);

  const bookingType = await webBookingType();
  const [types, testimonials, days] = await Promise.all([
    base.landingShowFees === "1" ? db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }) : [],
    base.landingShowTestimonials === "1" ? publicTestimonials() : [],
    bookingType ? bookableDays(bookingType.id) : [],
  ]);
  const messenger = messengerLink(code);
  const tel = telHref(base.clinicPhone);
  const hours = (en ? base.clinicHoursEn : base.clinicHours) || base.clinicHours;
  const action = submitLandingInquiry.bind(null, campaign?.trackingCode ?? null, pageId);
  const doctor = base.landingDoctorName;
  const promo = showPromo ? base.promo : null;
  const promoDesc = en ? base.landingPromoDescEn : base.landingPromoDesc;
  const feeNote = en ? base.landingFeeNoteEn : base.landingFeeNote;
  const bio = en ? base.landingDoctorBioEn : base.landingDoctorBio;
  const trust = t.trust(doctor);
  const trustIcons = [Icon.steth, Icon.pin, Icon.shield, Icon.check];

  const promoSection = promo && (
    <section className={`mx-auto max-w-6xl px-4 ${promoFirst ? "py-12" : "pb-12"}`}>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cm-red to-cm-redDark p-6 text-white shadow-xl sm:p-10">
        <Leaf className="pointer-events-none absolute -right-8 -top-4 w-64 text-white/10" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-cm-red">{t.promoBadge}</span>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">{promo.name}</h2>
            <p className="mt-3 max-w-xl leading-relaxed text-red-50">{promoDesc}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 text-center text-slate-800 shadow-lg">
            {promo.old && <div className="text-lg text-slate-400 line-through">{formatPhp(promo.old)}</div>}
            {promo.price && <div className="text-5xl font-extrabold text-cm-red">{formatPhp(promo.price)}</div>}
            {promo.old && promo.price && <div className="mt-1 text-sm font-semibold text-cm-green">{t.save} {formatPhp(promo.old - promo.price)}</div>}
            <div className="mt-1 text-xs text-slate-500">{t.plusConsult}</div>
            <a href="#form" className={`${redBtn} mt-4 w-full`}>{t.availPromo}</a>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div lang={en ? "en" : "fil"} className="bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo.jpg" alt="Clinica Medica 101 logo" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-bold text-cm-blue">Clinica Medica 101</div>
              <div className="truncate text-xs text-slate-500">Center for Integrative Medicine</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tel && (
              <a href={tel} aria-label={`${t.callUs}: ${base.clinicPhone}`} className="inline-flex items-center gap-1.5 rounded-full border border-cm-blue/30 px-3 py-2 text-sm font-semibold text-cm-blue hover:bg-cm-sky">
                {Icon.phone("h-4 w-4")} <span className="hidden min-[400px]:inline">{base.clinicPhone}</span>
              </a>
            )}
            <a href="#form" className="hidden rounded-full bg-cm-red px-5 py-2 text-sm font-semibold text-white hover:bg-cm-redDark sm:inline-flex">{t.schedule}</a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-cm-navy via-cm-blue to-[#0a73c2] text-white">
          <Leaf className="pointer-events-none absolute -right-10 bottom-0 w-72 text-cm-green/20" />
          <Leaf className="pointer-events-none absolute -left-16 top-10 w-56 -scale-x-100 text-white/5" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-8 md:grid-cols-[1.15fr_0.85fr] md:pb-20 md:pt-14">
            <div className="order-2 md:order-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
                <span className="h-2 w-2 rounded-full bg-cm-green" /> {t.accepting}
              </span>
              <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{copy.headline}</h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-50 sm:text-lg">{copy.sub}</p>
              {copy.offer && (
                <p className="mt-5 inline-flex items-start gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-cm-red shadow-lg">
                  <span aria-hidden="true">🎁</span>
                  {copy.offer}
                </p>
              )}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#form" className={redBtn}>{copy.cta} {Icon.arrow()}</a>
                {messenger && (
                  <a href={messenger} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-6 py-3.5 font-semibold ring-1 ring-white/40 hover:bg-white/20">
                    {Icon.chat()} {t.messenger}
                  </a>
                )}
              </div>
              <ul className="mt-7 grid gap-2 text-sm text-blue-50 sm:grid-cols-2">
                {trust.map((line, i) => (
                  <li key={line} className="flex items-center gap-2">{trustIcons[i]("h-5 w-5 text-cm-green")} {line}</li>
                ))}
              </ul>
            </div>
            <div className="order-1 flex justify-center md:order-2">
              <figure className="relative">
                <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-cm-green via-white/60 to-cm-red opacity-80 blur-[2px]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/doctor.jpg" alt={doctor} width={320} height={320} className="relative h-40 w-40 rounded-full border-[6px] border-white object-cover shadow-2xl sm:h-72 sm:w-72" />
                <figcaption className="absolute -bottom-4 left-1/2 w-max -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-cm-navy shadow-lg">{doctor}</figcaption>
              </figure>
            </div>
          </div>
          <svg viewBox="0 0 1440 60" className="block w-full text-white" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60V30C240 0 480 0 720 25s480 35 720 5v30H0z" fill="currentColor" />
          </svg>
        </section>

        {promoFirst && promoSection}

        {copy.benefits.length > 0 && (
          <section className={`mx-auto max-w-6xl px-4 ${promoFirst ? "pb-12" : "py-12"}`}>
            <p className="text-center text-sm font-semibold uppercase tracking-wider text-cm-green">{t.whyEyebrow}</p>
            <h2 className="mt-1 text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.whyTitle}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {copy.benefits.map((b) => (
                <li key={b} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cm-mint text-cm-green">{Icon.check()}</span>
                  <p className="mt-3 font-medium text-slate-800">{b}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!promoFirst && promoSection}

        <section className="bg-cm-sky">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[auto_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/doctor.jpg" alt={doctor} width={220} height={220} className="mx-auto h-44 w-44 rounded-3xl object-cover shadow-xl ring-4 ring-white md:h-56 md:w-56" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-cm-green">{t.meetEyebrow}</p>
              <h2 className="mt-1 text-2xl font-bold text-cm-navy sm:text-3xl">{doctor}</h2>
              <p className="text-sm text-slate-600">{base.landingDoctorTitle}</p>
              <p className="mt-4 max-w-2xl leading-relaxed text-slate-700">{bio}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.stepsTitle}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {t.steps(doctor).map(([title, body], i) => (
              <li key={title} className="relative rounded-2xl border border-slate-100 p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cm-blue text-lg font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold text-cm-navy">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {types.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-12">
            <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.feesTitle}</h2>
            <p className="mt-1 text-center text-sm text-slate-500">{t.feesSub}</p>
            <ul className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2">
              {types.map((ct) => (
                <li key={ct.id} className="flex flex-col rounded-2xl border-2 border-cm-blue/15 bg-white p-5 shadow-sm">
                  <div className="font-semibold text-cm-navy">{ct.name}</div>
                  {ct.description && <div className="mt-1 text-sm text-slate-600">{ct.description}</div>}
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-sm text-slate-500">{ct.durationMin} {t.minutes}</span>
                    <span className="text-2xl font-extrabold text-cm-blue">{formatPhp(ct.feePhp)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {feeNote && (
              <p className="mx-auto mt-4 flex max-w-4xl items-start gap-2 rounded-2xl bg-cm-mint px-4 py-3 text-sm font-medium text-cm-navy">
                {Icon.check("h-5 w-5 shrink-0 text-cm-green")} {feeNote}
              </p>
            )}
          </section>
        )}

        {testimonials.length > 0 && (
          <section className="bg-gradient-to-b from-white to-cm-mint/60">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.testimonialsTitle}</h2>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((tm, i) => (
                  <li key={i} className="flex flex-col rounded-2xl bg-white p-5 shadow-md">
                    <div className="text-lg tracking-wider text-amber-400" aria-label={`${tm.rating} stars`}>{"★".repeat(tm.rating)}</div>
                    <p className="mt-2 flex-1 leading-relaxed text-slate-700">“{tm.text}”</p>
                    <p className="mt-4 text-sm font-semibold text-cm-navy">{tm.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section id="form" className="scroll-mt-16 bg-gradient-to-br from-cm-navy to-cm-blue">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[0.9fr_1.1fr] md:items-start">
            <div className="text-white">
              <h2 className="text-3xl font-extrabold leading-tight">{copy.cta}</h2>
              <p className="mt-3 text-blue-50">{t.formLead}</p>
              <ul className="mt-6 space-y-3 text-sm text-blue-50">
                <li className="flex gap-2">{Icon.shield("h-5 w-5 shrink-0 text-cm-green")} {t.onlyDoctor(doctor)}</li>
                <li className="flex gap-2">{Icon.pin("h-5 w-5 shrink-0 text-cm-green")} {base.clinicAddress}</li>
                {hours && <li className="flex gap-2">{Icon.clock("h-5 w-5 shrink-0 text-cm-green")} {hours}</li>}
                {tel && (
                  <li className="flex gap-2">
                    {Icon.phone("h-5 w-5 shrink-0 text-cm-green")}
                    <span>{t.callUs}: <a href={tel} className="font-semibold text-white underline">{base.clinicPhone}</a></span>
                  </li>
                )}
              </ul>
            </div>
            <div className="min-w-0 rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
              {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <form action={action} className="space-y-4">
                <SlotPicker
                  days={days}
                  labels={{ title: t.pickTitle, help: t.pickHelp, callMe: t.callMe, none: t.noSlots, when: t.when, required: t.pickRequired, chosen: t.pickChosen }}
                  times={PREFERRED_TIMES.map((o) => ({ key: o.key, label: t.times[o.key] }))}
                />
                <p className="pt-1 text-base font-bold text-cm-navy">{t.detailsTitle}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className="label">{t.firstName}</span><input className="input" name="firstName" required maxLength={80} autoComplete="given-name" /></label>
                  <label><span className="label">{t.lastName}</span><input className="input" name="lastName" maxLength={80} autoComplete="family-name" /></label>
                  <label><span className="label">{t.mobile}</span><input className="input" name="mobile" required inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" /></label>
                  <label><span className="label">{t.email}</span><input className="input" name="email" type="email" autoComplete="email" /></label>
                </div>
                <label className="block">
                  <span className="label">{t.concern}</span>
                  <textarea className="input" name="concern" rows={3} maxLength={300} placeholder={t.concernPh} />
                </label>
                <label className="block"><span className="label">{t.how}</span>
                  <select className="input" name="contactMethod" defaultValue="CALL">
                    {CONTACT_METHODS.map((o) => <option key={o.key} value={o.key}>{t.methods[o.key]}</option>)}
                  </select>
                </label>
                {promo && (
                  <label className="flex items-start gap-2.5 rounded-xl border-2 border-cm-red/20 bg-red-50/50 p-3 text-sm">
                    <input type="checkbox" name="promoInterest" defaultChecked className="mt-0.5 h-4 w-4 accent-cm-red" />
                    <span>{t.promoInterest(promo.name)}{promo.price ? ` (${formatPhp(promo.price)})` : ""}</span>
                  </label>
                )}
                {/* Honeypot for bots: hidden from people and screen readers. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
                  <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                </div>
                <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-sm">
                  <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-cm-blue" />
                  <span>
                    {t.consent}{" "}
                    <Link href="/privacy" className="font-medium text-cm-blue underline" target="_blank">{t.privacy}</Link>.
                  </span>
                </label>
                <button className={`${redBtn} w-full`}>{days.length ? t.submitBook : t.submit} {Icon.arrow()}</button>
              </form>
            </div>
          </div>
        </section>

        {copy.faq.length > 0 && (
          <section className="mx-auto max-w-3xl px-4 py-12">
            <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.faqTitle}</h2>
            <div className="mt-6 space-y-3">
              {copy.faq.map((f) => (
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
              <a href="#form" className={redBtn}>{copy.cta} {Icon.arrow()}</a>
            </div>
          </section>
        )}

        {crossLink && (
          <section className="mx-auto max-w-3xl px-4 pb-12 text-center text-sm text-slate-600">
            {crossLink.text}{" "}
            <Link href={crossLink.href} className="font-semibold text-cm-blue underline">{crossLink.label}</Link>
          </section>
        )}
      </main>

      <footer className="bg-cm-navy pb-24 pt-10 text-sm text-blue-100 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/logo.jpg" alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
          <div className="font-semibold text-white">{base.clinicName}</div>
          <div>{base.clinicAddress}</div>
          {hours && <div>{hours}</div>}
          {tel && <a href={tel} className="font-semibold text-white underline">{base.clinicPhone}</a>}
          <Link href="/privacy" className="underline">{t.privacy}</Link>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
        <a href="#form" className={`${redBtn} w-full py-3`}>{copy.cta}</a>
      </div>
    </div>
  );
}
