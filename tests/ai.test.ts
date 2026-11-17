import { describe, expect, it, vi } from "vitest";
import { decideAiReply, factsText, isEmergency, mentionsHealth, prepareHistory, redact, replyProblems, type ClinicFacts } from "@/lib/messenger/ai";
import { handleMessage, type BotContext, type BotDeps } from "@/lib/messenger/bot";
import { SETTING_DEFAULTS as S } from "@/lib/settings";
import { SCRIPTS } from "../prisma/seed-data";
import { anonymize, extractPairs, replyHash } from "@/lib/messenger/ai-examples";

const scripts = Object.fromEntries(SCRIPTS.map((s) => [s.key, s.body]));
const facts = factsText({
  clinicName: S.clinicName, address: S.clinicAddress, phone: S.clinicPhone, hours: S.clinicHours, hoursEn: S.clinicHoursEn,
  doctorName: S.landingDoctorName, consultationTypes: [{ name: "Initial consultation", feeLabel: "₱1,000" }], feeNote: S.landingFeeNote,
  offer: S.landingOffer, promo: { name: "Vector Scan", oldPrice: "16000", price: "3000", desc: S.landingPromoDescEn },
  services: S.siteServicesEn, faq: S.landingFaq, scripts,
} satisfies ClinicFacts);

describe("AI reply safety", () => {
  it("spots health messages in Tagalog, Taglish and English", () => {
    for (const t of ["Masakit po ang tuhod ko", "may diabetes po ako", "ano po pwede inumin", "I have a rash", "nahihilo po ako lagi", "500mg po ba", "pwede po ba sa may thyroid", "lab results ko po"])
      expect(mentionsHealth(t), t).toBe(true);
  });

  it("does not flag ordinary ad inquiries (including Makati)", () => {
    for (const t of ["Hi po, magkano consultation?", "Saan po kayo sa Makati?", "Interested po sa vector scan", "May discount po ba sa senior?", "Tumatanggap po ba kayo ng HMO?", "Pwede po ba mag pa-sched sa Sabado?", "how much po", "info po"])
      expect(mentionsHealth(t), t).toBe(false);
  });

  it("masks mobile numbers and emails", () => {
    expect(redact("text me 0917 123 4567 or ana@mail.com")).toBe("text me [mobile] or [email]");
    expect(redact("+639171234567")).toBe("[mobile]");
  });

  it("removes health details from the history sent to the provider", () => {
    const h = prepareHistory([{ from: "patient", text: "masakit po likod ko" }, { from: "patient", text: "magkano po?" }]);
    expect(h[0].text).not.toContain("likod");
    expect(h[1].text).toBe("magkano po?");
  });

  it("rejects invented prices, doses, links and medical wording", () => {
    expect(replyProblems("₱1,000 po ang consultation, ₱3,000 ang Vector Scan.", facts)).toEqual([]);
    expect(replyProblems("₱1,000 po, ₱800 sa senior.", facts)).toEqual([]);
    expect(replyProblems("₱500 lang po ngayon!", facts)).toContain("unknown price ₱500");
    expect(replyProblems("1500 pesos po", facts)).toContain("unknown price ₱1500");
    expect(replyProblems("Take 500 mg po", facts)).toContain("dose");
    expect(replyProblems("See https://evil.example", facts)).toContain("link");
    expect(replyProblems("Baka ito ay arthritis po", facts)).toContain("medical wording");
  });

  it("never sends a health message to the AI when health inquiries are off", async () => {
    const call = vi.fn();
    const d = await decideAiReply({ text: "masakit po ulo ko, ano iinumin?", facts, history: [] }, call);
    expect(call).not.toHaveBeenCalled();
    expect(d).toEqual({ action: "handoff", reply: "" });
  });

  it("lets the AI answer health inquiries when allowed, and flags the doctor", async () => {
    const call = vi.fn(async () => ({ action: "answer" as const, reply: "Naiintindihan po namin. Si Dr. Lim po mismo ang titingin nito sa consultation (₱1,000). Gusto n'yo po bang mag-book?" }));
    const d = await decideAiReply({ text: "masakit po tuhod ko, matutulungan nyo ba?", facts, history: [{ from: "patient", text: "masakit po tuhod ko" }], allowHealth: true }, call);
    expect(call).toHaveBeenCalled();
    expect((call.mock.calls[0] as unknown as [{ history: { text: string }[] }])[0].history[0].text).toContain("tuhod");
    expect(d).toMatchObject({ action: "answer", notifyDoctor: true });
  });

  it("never sends emergencies to the AI", async () => {
    const call = vi.fn();
    expect(isEmergency("hirap po huminga si mama")).toBe(true);
    expect(await decideAiReply({ text: "chest pain po ngayon", facts, history: [], allowHealth: true }, call)).toEqual({ action: "handoff", reply: "" });
    expect(call).not.toHaveBeenCalled();
  });

  it("rejects promises of a cure", () => {
    expect(replyProblems("Siguradong gagaling po kayo!", facts)).toContain("promise of results");
  });

  it("replaces an unsafe AI reply with the hand-off", async () => {
    const call = vi.fn(async () => ({ action: "answer" as const, reply: "₱199 lang po!" }));
    expect(await decideAiReply({ text: "promo po?", facts, history: [] }, call)).toEqual({ action: "handoff", reply: "" });
  });

  it("returns null when the AI fails so the bot falls back", async () => {
    expect(await decideAiReply({ text: "info po", facts, history: [] }, vi.fn(async () => null))).toBeNull();
  });

  it("only states facts that exist (no bracket placeholders lost)", () => {
    expect(facts).toContain("₱1,000");
    expect(facts).toContain("₱3,000");
    expect(facts).toContain("Centuria");
  });
});

const ctx = (over: Partial<BotContext> = {}): BotContext => ({
  firstName: "Ana", hasFullName: false, privacyConsent: true, mobile: null, isNewConversation: false, upcoming: null,
  recentlyHandedOff: false, scripts, consultationTypes: [{ id: "t1", name: "Initial consultation", feeLabel: "₱1,000" }],
  privacyUrl: "https://clinic.test/privacy", ...over,
});
const deps = (over: Partial<BotDeps> = {}): BotDeps => ({
  slots: vi.fn(async () => ({ slots: [{ startAt: new Date("2026-11-20T06:00:00Z"), label: "Fri, Nov 20 2:00 PM" }], hasMore: false })),
  book: vi.fn(async () => ({ ok: true as const, dateLabel: "x", timeLabel: "y" })),
  confirmAppointment: vi.fn(async () => {}), recordConsent: vi.fn(async () => {}), saveName: vi.fn(async () => {}),
  saveMobile: vi.fn(async () => {}), handoff: vi.fn(async () => {}), setStage: vi.fn(async () => {}), ...over,
});

describe("Style examples from past replies", () => {
  const t = (fromClinic: boolean, text: string) => ({ fromClinic, text, at: new Date("2026-10-01T00:00:00Z") });

  it("pairs clinic replies with the patient's message and removes names and contacts", () => {
    const pairs = extractPairs(
      [t(false, "Hi po magkano consult? 09171234567"), t(true, "Hello Maria! ₱1,000 po ang consultation. Text nyo lang po kami sa 0922 875 2899.")],
      ["Maria Santos"],
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0].question).toBe("Hi po magkano consult? [mobile]");
    expect(pairs[0].reply).toBe("Hello [name]! ₱1,000 po ang consultation. Text nyo lang po kami sa [mobile].");
  });

  it("skips bot replies, very short replies and medicine advice", () => {
    const bot = "Salamat po sa pag-message sa clinic namin, ano po ang concern?";
    const pairs = extractPairs(
      [t(false, "hi"), t(true, bot), t(false, "ok"), t(true, "ok po"), t(false, "masakit ulo"), t(true, "Uminom po muna kayo ng 500mg paracetamol.")],
      [],
      new Set([replyHash(bot)]),
    );
    expect(pairs).toEqual([]);
  });

  it("removes links", () => {
    expect(anonymize("Book here https://x.test/start po", [])).toBe("Book here [link] po");
  });
});

describe("Messenger bot with AI", () => {
  it("answers a health inquiry with the AI and still flags the doctor", async () => {
    const d = deps({ ai: vi.fn(async () => ({ action: "answer" as const, reply: "Si Dr. Lim po ang titingin nito. Gusto n'yo po bang mag-book?", notifyDoctor: true })) });
    const r = await handleMessage(ctx(), { step: "IDLE" }, { text: "masakit po likod ko" }, d);
    expect(r.replies[0].byAi).toBe(true);
    expect(d.handoff).toHaveBeenCalled();
  });

  it("uses the AI answer for free text the scripts don't match", async () => {
    const d = deps({ ai: vi.fn(async () => ({ action: "answer" as const, reply: "Hindi pa po kami tumatanggap ng HMO." })) });
    const r = await handleMessage(ctx(), { step: "IDLE" }, { text: "HMO po?" }, d);
    expect(r.replies[0]).toMatchObject({ text: "Hindi pa po kami tumatanggap ng HMO.", byAi: true });
    expect(d.handoff).not.toHaveBeenCalled();
  });

  it("does not call the AI for keyword questions or button taps", async () => {
    const ai = vi.fn();
    await handleMessage(ctx(), { step: "IDLE" }, { text: "magkano po?" }, deps({ ai }));
    await handleMessage(ctx(), { step: "IDLE" }, { payload: "MENU_LOCATION" }, deps({ ai }));
    expect(ai).not.toHaveBeenCalled();
  });

  it("starts the booking buttons when the AI says book", async () => {
    const d = deps({ ai: vi.fn(async () => ({ action: "book" as const, reply: "Sige po, pili lang po ng oras." })) });
    const r = await handleMessage(ctx(), { step: "IDLE" }, { text: "pa reserve po sa friday" }, d);
    expect(r.replies[0].text).toBe("Sige po, pili lang po ng oras.");
    expect(r.state.step).toBe("PICK_SLOT");
  });

  it("hands off with the doctor script when the AI was skipped for health reasons", async () => {
    const d = deps({ ai: vi.fn(async () => ({ action: "handoff" as const, reply: "" })) });
    const r = await handleMessage(ctx(), { step: "IDLE" }, { text: "sumasakit po tiyan ko" }, d);
    expect(d.handoff).toHaveBeenCalled();
    expect(r.replies[0].text).toContain("ipapasa ko po ito sa doktor");
    expect(r.replies[0].byAi).toBe(false);
  });

  it("adds the privacy notice to an AI reply on first contact", async () => {
    const d = deps({ ai: vi.fn(async () => ({ action: "answer" as const, reply: "Hello po! ₱1,000 po ang consult." })) });
    const r = await handleMessage(ctx({ isNewConversation: true }), { step: "IDLE" }, { text: "interested po" }, d);
    expect(r.replies[0].text).toContain("https://clinic.test/privacy");
  });

  it("falls back to the scripted hand-off when the AI fails", async () => {
    const d = deps({ ai: vi.fn(async () => null) });
    const r = await handleMessage(ctx(), { step: "IDLE" }, { text: "HMO po?" }, d);
    expect(d.handoff).toHaveBeenCalled();
    expect(r.replies[0].text).toContain("ipapasa ko po ito sa doktor");
  });
});
