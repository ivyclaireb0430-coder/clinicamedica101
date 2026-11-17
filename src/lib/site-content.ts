import { lines } from "./funnel";
import type { Lang, LandingPageId } from "./landing-content";
import { pagePath } from "./landing-content";

// Public clinic website (/clinic in English, /clinic/tl in Taglish): what the clinic offers, the doctor, fees and how to reach us.
// Booking happens on the funnel pages (/start/...), so every "book" button links there.
// The services list is edited in Settings → Website. Pure helpers here are unit-tested.

/** Funnel page a service's "book" button opens. */
export type ServiceLink = "consultation" | "vector-scan" | "start";

export type SiteService = { name: string; description: string; link: ServiceLink };

const LINKS: readonly ServiceLink[] = ["consultation", "vector-scan", "start"];

/**
 * Services from "Name | Description | link" lines. The link is optional (consultation, vector-scan or start)
 * and anything else falls back to the consultation page. Lines without a name are skipped.
 */
export function parseServices(text: string): SiteService[] {
  return lines(text)
    .map((l) => {
      const [name = "", description = "", link = ""] = l.split("|").map((p) => p.trim());
      const key = link.toLowerCase() as ServiceLink;
      return { name, description, link: LINKS.includes(key) ? key : "consultation" };
    })
    .filter((s) => s.name.length > 0);
}

/** Booking page for a service, in the website's language. Tagged ?c=website so the dashboard can count it. */
export function bookingHref(link: ServiceLink, lang: Lang): string {
  const id = (link === "start" ? "start" : lang === "en" ? `${link}/en` : link) as LandingPageId;
  return `${pagePath(id)}?c=website`;
}

export function sitePath(lang: Lang): string {
  return lang === "en" ? "/clinic" : "/clinic/tl";
}

/** Google Maps search for the clinic address (opens the Maps app on phones). */
export function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export const SITE_UI = {
  tl: {
    nav: { services: "Services", approach: "Paano kami", doctor: "Doktor", fees: "Fees", contact: "Contact" },
    book: "Mag-book",
    bookConsult: "Mag-book ng consultation",
    seeServices: "Tingnan ang services",
    otherLang: "English",
    servicesEyebrow: "Ang aming services",
    servicesTitle: "Ano ang maitutulong namin sa inyo",
    servicesSub: "Bawat pasyente ay dumadaan sa consultation muna, para ang plano ay tugma sa inyong kondisyon, mga gamot at budget.",
    serviceCta: "Mag-book",
    promoCta: "Tingnan ang promo",
    approachEyebrow: "Integrative medicine",
    approachTitle: "Paano kami nag-aalaga",
    approach: [
      ["Pakikinig at assessment", "Mahabang consultation: ang buong kwento ninyo, lab results, mga gamot, at lifestyle."],
      ["Plano para sa inyo", "Ipapaliwanag ng doktor ang mga opsyon, ilang sessions, at magkano, bago kayo pumayag."],
      ["Follow-up at progress", "Sinusubaybayan namin ang inyong progress at inaayos ang plano kung kailangan."],
    ],
    meetEyebrow: "Kilalanin ang inyong doktor",
    feesTitle: "Consultation fees",
    feesSub: "Malinaw ang fees bago kayo mag-book. Walang sorpresa.",
    minutes: "minuto",
    promoBadge: "Promo ngayon",
    plusConsult: "+ consultation fee",
    testimonialsTitle: "Sabi ng aming mga pasyente",
    faqTitle: "Mga madalas itanong",
    contactEyebrow: "Bisitahin kami",
    contactTitle: "Location at oras",
    address: "Address",
    hours: "Oras",
    phone: "Tawagan o i-text",
    map: "Buksan sa Google Maps",
    messenger: "Mag-message sa Messenger",
    ctaTitle: "Handa na kayong magpa-consult?",
    ctaBody: "Pumili ng petsa at oras online at booked na kayo agad. Pwede rin kaming tawagan.",
    privacy: "Privacy Notice",
    disclaimer: "Ang impormasyon sa website na ito ay para sa kaalaman lamang at hindi kapalit ng consultation sa doktor.",
    off: "Salamat sa pagbisita! Mag-message po sa amin sa Facebook para sa inquiries.",
  },
  en: {
    nav: { services: "Services", approach: "Our approach", doctor: "Doctor", fees: "Fees", contact: "Contact" },
    book: "Book now",
    bookConsult: "Book a consultation",
    seeServices: "See our services",
    otherLang: "Tagalog",
    servicesEyebrow: "Our services",
    servicesTitle: "How we can help",
    servicesSub: "Every patient starts with a consultation, so the plan fits your condition, your medicines and your budget.",
    serviceCta: "Book",
    promoCta: "See the promo",
    approachEyebrow: "Integrative medicine",
    approachTitle: "How we care for you",
    approach: [
      ["Listening and assessment", "An unhurried consultation: your whole story, lab results, medicines and lifestyle."],
      ["A plan made for you", "The doctor explains your options, the number of sessions and the cost before you agree."],
      ["Follow-up and progress", "We track your progress and adjust the plan when needed."],
    ],
    meetEyebrow: "Meet your doctor",
    feesTitle: "Consultation fees",
    feesSub: "Clear fees before you book. No surprises.",
    minutes: "minutes",
    promoBadge: "Promo price",
    plusConsult: "+ consultation fee",
    testimonialsTitle: "What our patients say",
    faqTitle: "Frequently asked questions",
    contactEyebrow: "Visit us",
    contactTitle: "Location and hours",
    address: "Address",
    hours: "Hours",
    phone: "Call or text",
    map: "Open in Google Maps",
    messenger: "Message us on Messenger",
    ctaTitle: "Ready for your consultation?",
    ctaBody: "Pick a date and time online and you're booked right away. You can also call us.",
    privacy: "Privacy Notice",
    disclaimer: "The information on this website is for general information only and does not replace a consultation with a doctor.",
    off: "Thanks for visiting! Please message us on Facebook for inquiries.",
  },
} as const;
