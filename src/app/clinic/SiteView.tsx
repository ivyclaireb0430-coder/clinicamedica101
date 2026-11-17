import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { formatPhp } from "@/lib/time";
import { telHref } from "@/lib/funnel";
import { publicTestimonials } from "@/lib/funnel-db";
import { funnelCopy, type Lang } from "@/lib/landing-content";
import { SITE_UI, bookingHref, mapsHref, parseServices, sitePath } from "@/lib/site-content";
import { Icon, Leaf, loadLandingBase, messengerLink, redBtn } from "../start/LandingView";

// Public clinic website. Shares the look, doctor, fees and contact details of the landing pages;
// every "book" button goes to a funnel page, where the booking form lives.

const svg = (c: string, d: ReactNode) => (
  <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const SERVICE_ICONS = [
  Icon.steth,
  (c = "h-6 w-6") => svg(c, <><path d="M3 12h4l2-5 4 10 2-5h6" /></>), // scan / pulse
  (c = "h-6 w-6") => svg(c, <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>), // plan
  (c = "h-6 w-6") => svg(c, <><path d="M4 19V5M4 19h16" /><path d="M8 15l4-4 3 3 5-6" /></>), // progress
  (c = "h-6 w-6") => svg(c, <><path d="M12 21C7 17 3 13.5 3 9a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 4.5-4 8-9 12z" /></>), // wellness
];

// One accent per service card, in turn. Full class names so Tailwind keeps them.
const ACCENTS = [
  { tile: "bg-cm-sky text-cm-blue", bar: "border-t-cm-blue", link: "text-cm-blue" },
  { tile: "bg-cm-mint text-cm-green", bar: "border-t-cm-green", link: "text-[#2f7f34]" },
  { tile: "bg-cm-coralSoft text-cm-coral", bar: "border-t-cm-coral", link: "text-[#c4472f]" },
  { tile: "bg-cm-tealSoft text-cm-teal", bar: "border-t-cm-teal", link: "text-cm-teal" },
  { tile: "bg-cm-goldSoft text-cm-gold", bar: "border-t-cm-gold", link: "text-[#b47c00]" },
];
const STEP_COLORS = ["bg-cm-blue", "bg-cm-teal", "bg-cm-coral"];

/** Thin four-colour ribbon in the logo's colours plus gold. */
function Ribbon() {
  return (
    <div className="flex h-1.5" aria-hidden="true">
      <span className="flex-1 bg-cm-blue" /><span className="flex-1 bg-cm-green" /><span className="flex-1 bg-cm-gold" /><span className="flex-1 bg-cm-red" />
    </div>
  );
}

async function siteText(lang: Lang) {
  const en = lang === "en";
  const [enabled, headline, intro, services] = await Promise.all([
    getSetting("siteEnabled"),
    getSetting(en ? "siteHeadlineEn" : "siteHeadline"),
    getSetting(en ? "siteIntroEn" : "siteIntro"),
    getSetting(en ? "siteServicesEn" : "siteServices"),
  ]);
  return { enabled: enabled === "1", headline, intro, services: parseServices(services) };
}

export async function siteMetadata(lang: Lang): Promise<Metadata> {
  const { headline, intro } = await siteText(lang);
  return {
    title: "Clinica Medica 101 · Center for Integrative Medicine",
    description: intro || headline,
    robots: { index: true, follow: true },
    icons: { icon: "/landing/logo.jpg" },
    alternates: { languages: { "en-US": "/clinic", "fil-PH": "/clinic/tl" } },
    openGraph: { title: headline, description: intro, images: ["/landing/doctor.jpg"] },
  };
}

export async function SiteView({ lang }: { lang: Lang }) {
  const en = lang === "en";
  const t = SITE_UI[lang];
  const [site, base, types, consult] = await Promise.all([
    siteText(lang),
    loadLandingBase(),
    db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.consultationType.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!site.enabled) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="card text-center text-sm">{t.off}</div>
      </main>
    );
  }
  const testimonials = base.landingShowTestimonials === "1" ? await publicTestimonials() : [];
  const doctor = base.landingDoctorName;
  const bio = (en ? base.landingDoctorBioEn : base.landingDoctorBio) || base.landingDoctorBio;
  const hours = (en ? base.clinicHoursEn : base.clinicHours) || base.clinicHours;
  const feeNote = (en ? base.landingFeeNoteEn : base.landingFeeNote) || base.landingFeeNote;
  const promo = base.promo;
  const promoDesc = en ? base.landingPromoDescEn : base.landingPromoDesc;
  const tel = telHref(base.clinicPhone);
  const messenger = messengerLink("website");
  const book = bookingHref("consultation", lang);
  // FAQ from the consultation funnel, so the answers (and fees in them) stay in one place.
  const seniorFee = base.landingFeeNote.match(/₱\s?[\d,]+/)?.[0]?.replace(/\s/g, "") ?? "";
  const faq = funnelCopy("consultation", lang, {
    doctor, promoName: promo?.name ?? "", promoPrice: "", promoOld: "", consultFee: consult ? formatPhp(consult.feePhp) : "", seniorFee,
  }).faq;
  const nav = [
    ["#services", t.nav.services], ["#approach", t.nav.approach], ["#doctor", t.nav.doctor], ["#fees", t.nav.fees], ["#contact", t.nav.contact],
  ] as const;

  return (
    <div lang={en ? "en" : "fil"} className="bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
        <Ribbon />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href={sitePath(lang)} className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo.jpg" alt="Clinica Medica 101 logo" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-bold text-cm-blue">Clinica Medica 101</div>
              <div className="truncate text-xs text-slate-500">Center for Integrative Medicine</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 lg:flex" aria-label="Main">
            {nav.map(([href, label]) => <a key={href} href={href} className="hover:text-cm-blue">{label}</a>)}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={sitePath(en ? "tl" : "en")} hrefLang={en ? "fil" : "en"} className="rounded-full px-2.5 py-2 text-sm font-semibold text-cm-blue hover:bg-cm-sky">
              {t.otherLang}
            </Link>
            {tel && (
              <a href={tel} aria-label={`${t.phone}: ${base.clinicPhone}`} className="hidden items-center gap-1.5 rounded-full border border-cm-blue/30 px-3 py-2 text-sm font-semibold text-cm-blue hover:bg-cm-sky sm:inline-flex">
                {Icon.phone("h-4 w-4")} <span className="hidden md:inline">{base.clinicPhone}</span>
              </a>
            )}
            <Link href={book} className="inline-flex rounded-full bg-cm-red px-4 py-2 text-sm font-semibold text-white hover:bg-cm-redDark sm:px-5">{t.book}</Link>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 py-1.5 text-sm font-medium text-slate-600 lg:hidden" aria-label="Sections">
          {nav.map(([href, label]) => <a key={href} href={href} className="shrink-0 rounded-full px-3 py-1 hover:bg-cm-sky hover:text-cm-blue">{label}</a>)}
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-cm-navy via-cm-blue to-[#0a73c2] text-white">
          <Leaf className="pointer-events-none absolute -right-10 bottom-0 w-72 text-cm-green/20" />
          <Leaf className="pointer-events-none absolute -left-16 top-10 w-56 -scale-x-100 text-cm-teal/25" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cm-teal/25 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-10 left-1/3 h-56 w-56 rounded-full bg-cm-gold/15 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-8 md:grid-cols-[1.15fr_0.85fr] md:pb-20 md:pt-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-cm-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cm-gold ring-1 ring-cm-gold/40">
                <span className="h-2 w-2 rounded-full bg-cm-gold" /> Centuria Medical Makati
              </p>
              <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{site.headline}</h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-50 sm:text-lg">{site.intro}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={book} className={redBtn}>{t.bookConsult} {Icon.arrow()}</Link>
                <a href="#services" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-6 py-3.5 font-semibold ring-1 ring-white/40 hover:bg-white/20">
                  {t.seeServices}
                </a>
              </div>
            </div>
            <div className="hidden justify-center md:flex">
              <figure className="relative">
                <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-cm-green via-white/60 to-cm-red opacity-80 blur-[2px]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/doctor.jpg" alt={doctor} width={320} height={320} className="relative h-72 w-72 rounded-full border-[6px] border-white object-cover shadow-2xl" />
                <figcaption className="absolute -bottom-4 left-1/2 w-max -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-cm-navy shadow-lg">{doctor}</figcaption>
              </figure>
            </div>
          </div>
          <svg viewBox="0 0 1440 60" className="block w-full text-white" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60V30C240 0 480 0 720 25s480 35 720 5v30H0z" fill="currentColor" />
          </svg>
        </section>

        <section id="services" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-cm-green">{t.servicesEyebrow}</p>
          <h2 className="mt-1 text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.servicesTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600">{t.servicesSub}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {site.services.map((s, i) => {
              const isPromo = s.link === "vector-scan" && promo?.price;
              const a = ACCENTS[i % ACCENTS.length];
              return (
                <li key={s.name} className={`flex flex-col rounded-2xl border border-t-4 border-slate-100 ${a.bar} bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${a.tile}`}>{SERVICE_ICONS[i % SERVICE_ICONS.length]("h-6 w-6")}</span>
                    {isPromo && <span className="rounded-full bg-cm-red px-2.5 py-1 text-xs font-bold text-white">{t.promoBadge}</span>}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-cm-navy">{s.name}</h3>
                  {s.description && <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{s.description}</p>}
                  <Link href={bookingHref(s.link, lang)} className={`mt-4 inline-flex items-center gap-1.5 self-start font-semibold ${a.link} hover:underline`}>
                    {isPromo ? t.promoCta : t.serviceCta} {Icon.arrow("h-4 w-4")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="approach" className="scroll-mt-28 bg-gradient-to-br from-cm-cream via-cm-goldSoft/60 to-cm-tealSoft">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <p className="text-center text-sm font-semibold uppercase tracking-wider text-cm-teal">{t.approachEyebrow}</p>
            <h2 className="mt-1 text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.approachTitle}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {t.approach.map(([title, body], i) => (
                <li key={title} className="rounded-2xl bg-white p-5 shadow-sm">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${STEP_COLORS[i % STEP_COLORS.length]} text-lg font-bold text-white`}>{i + 1}</span>
                  <h3 className="mt-3 font-semibold text-cm-navy">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="doctor" className="relative scroll-mt-28 overflow-hidden bg-cm-sky">
          <Leaf className="pointer-events-none absolute -right-6 bottom-2 w-56 text-cm-teal/15" />
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[auto_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/doctor.jpg" alt={doctor} width={220} height={220} className="relative mx-auto h-44 w-44 rounded-3xl object-cover shadow-xl ring-4 ring-cm-gold/60 md:h-56 md:w-56" />
            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-wider text-cm-teal">{t.meetEyebrow}</p>
              <h2 className="mt-1 text-2xl font-bold text-cm-navy sm:text-3xl">{doctor}</h2>
              <p className="text-sm text-slate-600">{base.landingDoctorTitle}</p>
              <p className="mt-4 max-w-2xl leading-relaxed text-slate-700">{bio}</p>
            </div>
          </div>
        </section>

        {(types.length > 0 || promo) && (
          <section id="fees" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12">
            <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.feesTitle}</h2>
            <p className="mt-1 text-center text-sm text-slate-500">{t.feesSub}</p>
            <ul className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {types.map((ct, i) => (
                <li key={ct.id} className={`flex flex-col rounded-2xl border-2 border-t-4 bg-white p-5 shadow-sm ${i % 2 ? "border-cm-teal/20 border-t-cm-teal" : "border-cm-blue/15 border-t-cm-blue"}`}>
                  <div className="font-semibold text-cm-navy">{ct.name}</div>
                  {ct.description && <div className="mt-1 text-sm text-slate-600">{ct.description}</div>}
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <span className="text-sm text-slate-500">{ct.durationMin} {t.minutes}</span>
                    <span className={`text-2xl font-extrabold ${i % 2 ? "text-cm-teal" : "text-cm-blue"}`}>{formatPhp(ct.feePhp)}</span>
                  </div>
                </li>
              ))}
              {promo?.price && (
                <li className="flex flex-col rounded-2xl border-2 border-t-4 border-cm-red/25 border-t-cm-red bg-cm-coralSoft/60 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-cm-navy">{promo.name}</span>
                    <span className="rounded-full bg-cm-red px-2.5 py-0.5 text-xs font-bold text-white">{t.promoBadge}</span>
                  </div>
                  {promoDesc && <div className="mt-1 line-clamp-3 text-sm text-slate-600">{promoDesc}</div>}
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <span className="text-xs text-slate-500">{t.plusConsult}</span>
                    <span className="text-right">
                      {promo.old && <span className="block text-sm text-slate-400 line-through">{formatPhp(promo.old)}</span>}
                      <span className="text-2xl font-extrabold text-cm-red">{formatPhp(promo.price)}</span>
                    </span>
                  </div>
                </li>
              )}
            </ul>
            {feeNote && (
              <p className="mx-auto mt-4 flex max-w-5xl items-start gap-2 rounded-2xl bg-cm-goldSoft px-4 py-3 text-sm font-medium text-cm-navy ring-1 ring-cm-gold/30">
                {Icon.check("h-5 w-5 shrink-0 text-cm-green")} {feeNote}
              </p>
            )}
          </section>
        )}

        {testimonials.length > 0 && (
          <section className="bg-gradient-to-b from-cm-cream to-cm-goldSoft">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.testimonialsTitle}</h2>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((tm, i) => (
                  <li key={i} className="flex flex-col rounded-2xl border-l-4 border-cm-gold bg-white p-5 shadow-md">
                    <div className="text-lg tracking-wider text-cm-gold" aria-label={`${tm.rating} stars`}>{"★".repeat(tm.rating)}</div>
                    <p className="mt-2 flex-1 leading-relaxed text-slate-700">“{tm.text}”</p>
                    <p className="mt-4 text-sm font-semibold text-cm-navy">{tm.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {faq.length > 0 && (
          <section className="mx-auto max-w-3xl px-4 py-12">
            <h2 className="text-center text-2xl font-bold text-cm-navy sm:text-3xl">{t.faqTitle}</h2>
            <div className="mt-6 space-y-3">
              {faq.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-4 open:border-cm-teal/40 open:bg-cm-tealSoft/40 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-cm-navy">
                    {f.q}
                    <span className="text-xl text-cm-teal transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-slate-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section id="contact" className="scroll-mt-28 bg-gradient-to-br from-cm-navy via-cm-blue to-cm-teal text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-cm-gold">{t.contactEyebrow}</p>
              <h2 className="mt-1 text-3xl font-extrabold">{t.contactTitle}</h2>
              <dl className="mt-6 space-y-4 text-blue-50">
                <div className="flex gap-3">
                  {Icon.pin("mt-0.5 h-5 w-5 shrink-0 text-cm-green")}
                  <div><dt className="text-xs uppercase tracking-wider text-blue-200">{t.address}</dt><dd>{base.clinicAddress}</dd>
                    <a href={mapsHref(base.clinicAddress)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-white underline">{t.map}</a>
                  </div>
                </div>
                {hours && (
                  <div className="flex gap-3">{Icon.clock("mt-0.5 h-5 w-5 shrink-0 text-cm-green")}<div><dt className="text-xs uppercase tracking-wider text-blue-200">{t.hours}</dt><dd>{hours}</dd></div></div>
                )}
                {tel && (
                  <div className="flex gap-3">{Icon.phone("mt-0.5 h-5 w-5 shrink-0 text-cm-green")}<div><dt className="text-xs uppercase tracking-wider text-blue-200">{t.phone}</dt><dd><a href={tel} className="font-semibold text-white underline">{base.clinicPhone}</a></dd></div></div>
                )}
              </dl>
            </div>
            <div className="rounded-3xl border-t-8 border-cm-gold bg-white p-6 text-slate-800 shadow-2xl sm:p-8">
              <h3 className="text-2xl font-extrabold text-cm-navy">{t.ctaTitle}</h3>
              <p className="mt-2 text-slate-600">{t.ctaBody}</p>
              <div className="mt-6 flex flex-col gap-3">
                <Link href={book} className={`${redBtn} w-full`}>{t.bookConsult} {Icon.arrow()}</Link>
                {tel && (
                  <a href={tel} className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-cm-blue/30 px-6 py-3 font-semibold text-cm-blue hover:bg-cm-sky">
                    {Icon.phone()} {base.clinicPhone}
                  </a>
                )}
                {messenger && (
                  <a href={messenger} className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-cm-blue/30 px-6 py-3 font-semibold text-cm-blue hover:bg-cm-sky">
                    {Icon.chat()} {t.messenger}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Ribbon />
      <footer className="bg-cm-navy pb-24 pt-10 text-sm text-blue-100 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/logo.jpg" alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
          <div className="font-semibold text-white">{base.clinicName}</div>
          <div>{base.clinicAddress}</div>
          {hours && <div>{hours}</div>}
          {tel && <a href={tel} className="font-semibold text-white underline">{base.clinicPhone}</a>}
          <div className="flex gap-4">
            <Link href="/privacy" className="underline">{t.privacy}</Link>
            <Link href={sitePath(en ? "tl" : "en")} className="underline">{t.otherLang}</Link>
          </div>
          <p className="mt-2 max-w-xl text-xs text-blue-200">{t.disclaimer}</p>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
        <Link href={book} className={`${redBtn} w-full py-3`}>{t.bookConsult}</Link>
      </div>
    </div>
  );
}
