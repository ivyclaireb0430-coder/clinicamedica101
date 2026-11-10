import { z } from "zod";

// Sales funnel: the public landing page (/start) and its inquiry form. Pure helpers here are unit-tested;
// database work lives in funnel-db.ts so this file can be imported by tests without a database.

/** Campaign tracking code from the landing page URL: ?c=, or ?utm_campaign= (what Meta/Google ads set). */
export function campaignCodeFrom(params: Record<string, string | string[] | undefined>): string | null {
  for (const key of ["c", "utm_campaign", "ref"]) {
    const raw = params[key];
    const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
    if (v && /^[a-z0-9][a-z0-9_-]{0,59}$/.test(v)) return v;
  }
  return null;
}

/**
 * Philippine mobile number in the 09XXXXXXXXX form, or null if it is not one.
 * Accepts spaces, dashes, dots, brackets, and the +63 / 63 prefixes.
 */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  let local = digits;
  if (local.startsWith("63")) local = `0${local.slice(2)}`;
  else if (local.startsWith("9") && local.length === 10) local = `0${local}`;
  return /^09\d{9}$/.test(local) ? local : null;
}

/** One item per non-empty line. */
export function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** FAQ from "Question | Answer" lines. Lines without a "|" are skipped. */
export function parseFaq(text: string): { q: string; a: string }[] {
  return lines(text)
    .map((l) => {
      const i = l.indexOf("|");
      return i < 0 ? null : { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() };
    })
    .filter((x): x is { q: string; a: string } => Boolean(x && x.q && x.a));
}

export const PREFERRED_TIMES = [
  { key: "ANY", label: "Kahit kailan" },
  { key: "WEEKDAY_PM", label: "Weekday, hapon (2–5pm)" },
  { key: "WEEKDAY_EVE", label: "Weekday, gabi (5–9pm)" },
  { key: "WEEKEND", label: "Sabado o Linggo" },
] as const;

/** "0922 875 2899" → "tel:+639228752899"; null when it isn't a PH mobile number. */
export function telHref(phone: string): string | null {
  const n = normalizePhMobile(phone);
  return n ? `tel:+63${n.slice(1)}` : null;
}

export const CONTACT_METHODS = [
  { key: "CALL", label: "Tawag" },
  { key: "SMS", label: "Text" },
  { key: "VIBER", label: "Viber" },
  { key: "EMAIL", label: "Email" },
] as const;

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const landingInquirySchema = z.object({
  firstName: z.string().trim().min(1, "Pakilagay ang pangalan").max(80),
  lastName: optional(80),
  mobile: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhMobile(v);
      if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pakilagay ang tamang mobile number (hal. 0917 123 4567)" });
      return n ?? "";
    }),
  email: z.string().trim().email("Mali ang email").optional().or(z.literal("")).transform((v) => v || undefined),
  concern: optional(300),
  preferredTime: z.enum(PREFERRED_TIMES.map((t) => t.key) as [string, ...string[]]).default("ANY"),
  contactMethod: z.enum(CONTACT_METHODS.map((t) => t.key) as [string, ...string[]]).default("CALL"),
  promoInterest: z.literal("on").optional(),
  // Self-booking: ISO start time of the chosen slot, or empty for "call me instead".
  slotStart: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "slot" });
        return undefined;
      }
      return d;
    }),
  consent: z.literal("on", { errorMap: () => ({ message: "Kailangan ang pahintulot sa Privacy Notice para makapag-inquire" }) }),
});

export type LandingInquiry = z.infer<typeof landingInquirySchema>;

const ERRORS: Record<string, { tl: string; en: string }> = {
  firstName: { tl: "Pakilagay ang pangalan.", en: "Please enter your first name." },
  mobile: { tl: "Pakilagay ang tamang mobile number (hal. 0917 123 4567).", en: "Please enter a valid PH mobile number (e.g. 0917 123 4567)." },
  email: { tl: "Mali ang email.", en: "Please check your email address." },
  slotStart: { tl: "Pakipili ng petsa at oras sa calendar.", en: "Please pick a date and time on the calendar." },
  taken: { tl: "Pasensya na, may nakakuha na ng oras na iyan. Pakipili ng ibang oras.", en: "Sorry, that time was just taken. Please choose another time." },
  consent: { tl: "Kailangan ang pahintulot sa Privacy Notice para makapag-inquire.", en: "Please agree to the Privacy Notice so we can contact you." },
  rate: { tl: "Masyadong maraming submission. Pakisubukan ulit mamaya o mag-message sa amin sa Facebook.", en: "Too many submissions. Please try again later or message us on Facebook." },
};

/** Form error shown to the visitor, in the page's language. `field` is the failing field, or "rate". */
export function inquiryErrorMessage(field: string, lang: "tl" | "en"): string {
  return (ERRORS[field] ?? { tl: "Pakisuri ang form.", en: "Please check the form." })[lang];
}

/** Front desk note for a web inquiry. No health information (the concern is stored encrypted, separately). */
export function inquiryNote(
  i: Pick<LandingInquiry, "preferredTime" | "contactMethod" | "promoInterest">,
  campaignName?: string | null,
  promoName?: string | null,
): string {
  const time = PREFERRED_TIMES.find((t) => t.key === i.preferredTime)?.label ?? i.preferredTime;
  const method = CONTACT_METHODS.find((t) => t.key === i.contactMethod)?.label ?? i.contactMethod;
  const promo = i.promoInterest && promoName ? ` Interesado sa ${promoName} promo.` : "";
  return `Web form${campaignName ? ` (${campaignName})` : ""}: gusto ng schedule ${time.toLowerCase()}, contact via ${method}.${promo}`;
}

/** At most `max` items, evenly spread from first to last (keeps morning and afternoon choices). */
export function spreadSlots<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  if (max <= 1) return items.slice(0, max);
  const picked = new Set<number>();
  for (let i = 0; i < max; i++) picked.add(Math.round((i * (items.length - 1)) / (max - 1)));
  return [...picked].sort((a, b) => a - b).map((i) => items[i]);
}

/**
 * Simple fixed-window limiter, in memory (one app process). Stops a script from flooding the leads list;
 * the honeypot field catches most bots before this.
 */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now = Date.now()): boolean => {
    const h = hits.get(key);
    if (!h || h.resetAt <= now) {
      if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    h.count++;
    return h.count <= max;
  };
}
