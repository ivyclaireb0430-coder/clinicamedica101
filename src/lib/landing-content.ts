// Copy for the landing pages. "/start" is edited in Settings; the dedicated funnels below are written here
// in Taglish and English. Prices are never hard-coded: they come from settings and consultation types.

export type Lang = "tl" | "en";
export type FunnelKey = "vector-scan" | "consultation";

/** Every landing page id. Stored on visits and leads, so keep these stable. */
export const LANDING_PAGES = ["start", "vector-scan", "vector-scan/en", "consultation", "consultation/en"] as const;
export type LandingPageId = (typeof LANDING_PAGES)[number];

export const LANDING_PAGE_LABELS: Record<LandingPageId, string> = {
  start: "General (Taglish)",
  "vector-scan": "Vector Scan (Taglish)",
  "vector-scan/en": "Vector Scan (English)",
  consultation: "Consultation (Taglish)",
  "consultation/en": "Consultation (English)",
};

export function isLandingPage(v: unknown): v is LandingPageId {
  return typeof v === "string" && (LANDING_PAGES as readonly string[]).includes(v);
}

export function pagePath(id: LandingPageId): string {
  return id === "start" ? "/start" : `/start/${id}`;
}

export function pageLang(id: LandingPageId): Lang {
  return id.endsWith("/en") ? "en" : "tl";
}

/** Interface text shared by every landing page. */
export const UI = {
  tl: {
    accepting: "Tumatanggap ng bagong pasyente",
    messenger: "Mag-message sa Messenger",
    schedule: "Magpa-schedule",
    trust: (doctor: string) => [`Personal na consultation kay ${doctor}`, "Centuria Medical Makati", "Kumpidensyal ang inyong records", "Malinaw ang fees bago mag-book"],
    whyEyebrow: "Bakit Clinica Medica 101",
    whyTitle: "Alaga na nakatutok sa inyo",
    meetEyebrow: "Kilalanin ang inyong doktor",
    stepsTitle: "Madali lang magpa-schedule",
    steps: (doctor: string) => [
      ["Mag-fill up ng form", "Isang minuto lang. Pangalan, mobile number, at kung kailan kayo libre."],
      ["Kokontakin namin kayo", "Tatawagan o ite-text kayo ng aming front desk para sa schedule at fees."],
      [`Consultation kay ${doctor}`, "Pupunta kayo sa clinic sa Centuria Medical Makati sa napagkasunduang oras."],
    ],
    feesTitle: "Consultation at fees",
    feesSub: "Walang sorpresa. Ito ang babayaran ninyo sa consultation.",
    minutes: "minuto",
    testimonialsTitle: "Sabi ng aming mga pasyente",
    promoBadge: "Promo ngayon",
    save: "Tipid",
    plusConsult: "+ consultation fee",
    availPromo: "I-avail ang promo",
    formLead: "Libre ang mag-inquire. Kokontakin kayo ng aming front desk para sa schedule, karaniwan sa loob ng isang araw.",
    onlyDoctor: (doctor: string) => `Si ${doctor} lang ang makakabasa ng inyong health concern.`,
    firstName: "Pangalan *",
    lastName: "Apelyido",
    mobile: "Mobile number *",
    email: "Email (optional)",
    concern: "Ano po ang inyong iniinda? (optional)",
    concernPh: "Hal. matagal nang sakit ng ulo, hirap matulog…",
    when: "Kailan kayo libre?",
    how: "Paano namin kayo kokontakin?",
    times: { ANY: "Kahit kailan", WEEKDAY_AM: "Weekday, umaga", WEEKDAY_PM: "Weekday, hapon", SATURDAY: "Sabado" },
    methods: { CALL: "Tawag", SMS: "Text", VIBER: "Viber", EMAIL: "Email" },
    promoInterest: (name: string) => `Interesado ako sa ${name} promo`,
    consent: "Pumapayag ako na gamitin ng clinic ang impormasyong ito para kontakin ako at i-schedule ang aking consultation, ayon sa",
    privacy: "Privacy Notice",
    submit: "Ipadala ang inquiry",
    faqTitle: "Mga madalas itanong",
    off: "Salamat sa pagbisita! Mag-message po sa amin sa Facebook para sa inquiries.",
    thanksTitle: "Salamat po!",
    thanksBody: "Natanggap na namin ang inyong inquiry. Kokontakin kayo ng aming front desk sa lalong madaling panahon (karaniwan sa loob ng isang araw, Lunes hanggang Sabado).",
    thanksFaster: "Gusto ninyo ng mas mabilis na sagot?",
    thanksMessenger: "Mag-message sa amin sa Messenger",
    back: "Bumalik",
    otherFunnel: { "vector-scan": "Consultation lang muna?", consultation: "May promo din kami:" },
    seeOther: { "vector-scan": "Tingnan ang consultation", consultation: "Tingnan ang Vector Scan promo" },
  },
  en: {
    accepting: "Now accepting new patients",
    messenger: "Message us on Messenger",
    schedule: "Book now",
    trust: (doctor: string) => [`Personal consultation with ${doctor}`, "Centuria Medical Makati", "Your records stay confidential", "Clear fees before you book"],
    whyEyebrow: "Why Clinica Medica 101",
    whyTitle: "Care that focuses on you",
    meetEyebrow: "Meet your doctor",
    stepsTitle: "Booking is easy",
    steps: (doctor: string) => [
      ["Fill out the form", "It takes a minute: your name, mobile number and when you're free."],
      ["We'll get in touch", "Our front desk will call or text you to confirm your schedule and fees."],
      [`See ${doctor}`, "Visit the clinic at Centuria Medical Makati at your agreed time."],
    ],
    feesTitle: "Consultation fees",
    feesSub: "No surprises. This is what you pay for the consultation.",
    minutes: "minutes",
    testimonialsTitle: "What our patients say",
    promoBadge: "Promo price",
    save: "You save",
    plusConsult: "+ consultation fee",
    availPromo: "Claim the promo",
    formLead: "Inquiries are free. Our front desk will contact you to set your schedule, usually within one day.",
    onlyDoctor: (doctor: string) => `Only ${doctor} can read your health concern.`,
    firstName: "First name *",
    lastName: "Last name",
    mobile: "Mobile number *",
    email: "Email (optional)",
    concern: "What would you like help with? (optional)",
    concernPh: "e.g. recurring headaches, trouble sleeping…",
    when: "When are you free?",
    how: "How should we contact you?",
    times: { ANY: "Any time", WEEKDAY_AM: "Weekday mornings", WEEKDAY_PM: "Weekday afternoons", SATURDAY: "Saturday" },
    methods: { CALL: "Call", SMS: "Text", VIBER: "Viber", EMAIL: "Email" },
    promoInterest: (name: string) => `I'm interested in the ${name} promo`,
    consent: "I agree that the clinic may use this information to contact me and schedule my consultation, as described in the",
    privacy: "Privacy Notice",
    submit: "Send my inquiry",
    faqTitle: "Frequently asked questions",
    off: "Thanks for visiting! Please message us on Facebook for inquiries.",
    thanksTitle: "Thank you!",
    thanksBody: "We've received your inquiry. Our front desk will contact you soon (usually within one day, Monday to Saturday).",
    thanksFaster: "Want a faster reply?",
    thanksMessenger: "Message us on Messenger",
    back: "Back",
    otherFunnel: { "vector-scan": "Just want a consultation?", consultation: "We also have a promo:" },
    seeOther: { "vector-scan": "See consultation details", consultation: "See the Vector Scan promo" },
  },
} as const;

export type Ui = (typeof UI)[Lang];

/** Values the copy below needs, already formatted (e.g. "₱1,000"). */
export type CopyVars = { doctor: string; promoName: string; promoPrice: string; promoOld: string; consultFee: string; seniorFee: string };

export type FunnelCopy = {
  headline: string;
  sub: string;
  offer: string;
  benefits: string[];
  faq: { q: string; a: string }[];
  cta: string;
};

export function funnelCopy(funnel: FunnelKey, lang: Lang, x: CopyVars): FunnelCopy {
  const fees = {
    tl: `${x.consultFee} ang consultation fee${x.seniorFee ? ` (${x.seniorFee} para sa Senior Citizens at PWD, dalhin lang ang ID)` : ""}.`,
    en: `The consultation fee is ${x.consultFee}${x.seniorFee ? ` (${x.seniorFee} for Senior Citizens and PWDs with a valid ID)` : ""}.`,
  }[lang];
  if (funnel === "vector-scan") {
    return lang === "tl"
      ? {
          headline: `${x.promoName}: mas buong larawan ng inyong kalusugan, ${x.promoPrice} na lang`,
          sub: `Bahagi ng integrative assessment ni ${x.doctor} sa Centuria Medical Makati. Promo price ${x.promoPrice} (dati ${x.promoOld}), dagdag ang consultation fee.`,
          offer: `PROMO: ${x.promoName} ${x.promoPrice} na lang (dati ${x.promoOld}).`,
          benefits: [
            "Non-invasive na scan",
            `Kasama sa assessment ni ${x.doctor}`,
            "Ipinapaliwanag ang resulta nang malinaw",
            "Gabay para sa planong tugma sa inyo",
          ],
          faq: [
            { q: `Ano ang ${x.promoName}?`, a: `Isang scan na ginagamit ni ${x.doctor} bilang bahagi ng integrative assessment. Ipapaliwanag niya sa consultation kung paano ito makakatulong sa inyo.` },
            { q: "Magkano lahat?", a: `${x.promoPrice} ang ${x.promoName} (promo, dati ${x.promoOld}). ${fees}` },
            { q: "Kapalit ba ito ng lab tests o ng payo ng ibang doktor ko?", a: "Hindi po. Kasama ito sa assessment at hindi nito pinapalitan ang lab tests o ang payo ng inyong ibang doktor." },
            { q: "Kailangan ba ng referral?", a: "Hindi po. Pwede kayong mag-inquire at magpa-schedule nang direkta." },
          ],
          cta: `Magpa-schedule ng ${x.promoName}`,
        }
      : {
          headline: `${x.promoName}: a fuller picture of your health, now only ${x.promoPrice}`,
          sub: `Part of ${x.doctor}'s integrative assessment at Centuria Medical Makati. Promo price ${x.promoPrice} (regular ${x.promoOld}), plus the consultation fee.`,
          offer: `PROMO: ${x.promoName} for only ${x.promoPrice} (regular ${x.promoOld}).`,
          benefits: ["Non-invasive scan", `Part of ${x.doctor}'s assessment`, "Results explained clearly", "Guides a plan that fits you"],
          faq: [
            { q: `What is the ${x.promoName}?`, a: `A scan ${x.doctor} uses as part of an integrative assessment. She will explain during your consultation how it can help in your case.` },
            { q: "How much is it in total?", a: `The ${x.promoName} is ${x.promoPrice} (promo, regular ${x.promoOld}). ${fees}` },
            { q: "Does it replace lab tests or my other doctors' advice?", a: "No. It is part of the assessment and does not replace lab tests or advice from your other doctors." },
            { q: "Do I need a referral?", a: "No. You can inquire and book directly." },
          ],
          cta: `Book a ${x.promoName}`,
        };
  }
  return lang === "tl"
    ? {
        headline: `Konsultasyon kay ${x.doctor}: pakikinggan ang buong kwento ninyo`,
        sub: `Integrative medicine consultation sa Centuria Medical Makati. ${fees}`,
        offer: "",
        benefits: [
          "Mahabang consultation, hindi minamadali",
          "Plano na swak sa inyong kondisyon at budget",
          "May follow-up para masubaybayan ang progress ninyo",
          "Nasa Makati, malapit sa Kalayaan Ave",
        ],
        faq: [
          { q: "Magkano ang consultation?", a: `${fees} Pareho ang rate sa follow-up.` },
          { q: "Ano ang dapat dalhin?", a: "Ang inyong lab results (kung meron), listahan ng iniinom na gamot, at Senior o PWD ID kung mayroon." },
          { q: "Paano kung may iniinom na akong gamot?", a: "Dalhin po ang listahan ng gamot ninyo. Hindi namin kayo pahihintuin nang walang usapan." },
          { q: "Kailangan ba ng referral?", a: "Hindi po. Pwede kayong mag-inquire at magpa-schedule nang direkta." },
        ],
        cta: `Magpa-schedule kay ${x.doctor}`,
      }
    : {
        headline: `See ${x.doctor}: a doctor who listens to your whole story`,
        sub: `Integrative medicine consultations at Centuria Medical Makati. ${fees}`,
        offer: "",
        benefits: ["Unhurried, in-depth consultations", "A plan that fits your condition and budget", "Follow-ups to track your progress", "In Makati, near Kalayaan Ave"],
        faq: [
          { q: "How much is a consultation?", a: `${fees} Follow-ups are the same rate.` },
          { q: "What should I bring?", a: "Your lab results (if any), a list of your current medicines, and your Senior or PWD ID if you have one." },
          { q: "What if I'm already taking medicine?", a: "Please bring your list of medicines. We will never ask you to stop them without discussing it first." },
          { q: "Do I need a referral?", a: "No. You can inquire and book directly." },
        ],
        cta: `Book with ${x.doctor}`,
      };
}
