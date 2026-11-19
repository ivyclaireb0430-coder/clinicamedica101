import { describe, expect, it, vi } from "vitest";
import { detectIntent, handleMessage, normalizePhMobile, type BotContext, type BotDeps, type FlowState } from "@/lib/messenger/bot";
import { SCRIPTS } from "../prisma/seed-data";

const ctx = (over: Partial<BotContext> = {}): BotContext => ({
  firstName: "Ana",
  hasFullName: false,
  privacyConsent: false,
  mobile: null,
  isNewConversation: false,
  upcoming: null,
  recentlyHandedOff: false,
  scripts: Object.fromEntries(SCRIPTS.map((s) => [s.key, s.body])),
  consultationTypes: [{ id: "t1", name: "Initial consultation", feeLabel: "₱2,500" }],
  privacyUrl: "https://clinic.test/privacy",
  ...over,
});

const deps = (over: Partial<BotDeps> = {}): BotDeps => ({
  slots: vi.fn(async () => ({ slots: [{ startAt: new Date("2026-11-03T02:00:00Z"), label: "Tue, Nov 3 10:00 AM" }], hasMore: false })),
  book: vi.fn(async () => ({ ok: true as const, dateLabel: "Tue, Nov 3, 2026", timeLabel: "10:00 AM" })),
  confirmAppointment: vi.fn(async () => {}),
  recordConsent: vi.fn(async () => {}),
  saveName: vi.fn(async () => {}),
  saveMobile: vi.fn(async () => {}),
  saveEmail: vi.fn(async () => {}),
  handoff: vi.fn(async () => {}),
  setStage: vi.fn(async () => {}),
  ...over,
});

const IDLE: FlowState = { step: "IDLE" };

describe("Messenger bot", () => {
  it("greets a new conversation with the menu (a script may still link the privacy page)", async () => {
    const d = deps();
    const r = await handleMessage(ctx({ isNewConversation: true }), IDLE, { text: "Hello po" }, d);
    expect(r.replies[0].text).toContain("Hi Ana");
    expect(r.replies[0].quickReplies?.map((q) => q.payload)).toContain("MENU_BOOK");
    expect(d.setStage).toHaveBeenCalledWith("REPLIED");
  });

  it("keeps quick reply titles within Messenger's 20 characters", async () => {
    const r = await handleMessage(ctx({ isNewConversation: true }), IDLE, { text: "hi" }, deps());
    for (const q of r.replies[0].quickReplies ?? []) expect(q.title.length).toBeLessThanOrEqual(20);
  });

  it("answers fee questions and moves the lead to Fee explained", async () => {
    const d = deps();
    const r = await handleMessage(ctx(), IDLE, { text: "magkano po consultation?" }, d);
    expect(r.replies[0].text).toContain("consultation fee");
    expect(d.setStage).toHaveBeenCalledWith("FEE_EXPLAINED");
  });

  it("hands symptom questions to the doctor and never answers medically", async () => {
    const d = deps();
    const r = await handleMessage(ctx(), IDLE, { text: "masakit tiyan ko tuwing gabi, ano iinumin ko?" }, d);
    expect(d.handoff).toHaveBeenCalled();
    expect(r.replies[0].text).toContain("ipapasa ko po ito sa doktor");
    expect(r.replies[0].text).toContain("ER");
  });

  it("stays quiet on repeat hand-offs within the quiet period", async () => {
    const d = deps();
    const r = await handleMessage(ctx({ recentlyHandedOff: true }), IDLE, { text: "ano na po, wala pa rin sagot?" }, d);
    expect(d.handoff).toHaveBeenCalled();
    expect(r.replies).toEqual([]);
  });

  it("runs the full booking flow: slot → name → mobile → booked, with no agree step", async () => {
    const d = deps();
    let r = await handleMessage(ctx(), IDLE, { payload: "MENU_BOOK" }, d);
    expect(d.recordConsent).not.toHaveBeenCalled();
    expect(r.state.step).toBe("PICK_SLOT"); // single consultation type skips the type step
    const slot = r.replies[0].quickReplies!.find((q) => q.payload.startsWith("SLOT:"))!;
    r = await handleMessage(ctx({ privacyConsent: true }), r.state, { payload: slot.payload }, d);
    expect(r.state.step).toBe("ASK_NAME");
    r = await handleMessage(ctx({ privacyConsent: true }), r.state, { text: "Ana Santos" }, d);
    expect(d.saveName).toHaveBeenCalledWith("Ana Santos");
    expect(r.state.step).toBe("ASK_MOBILE");
    r = await handleMessage(ctx({ privacyConsent: true }), r.state, { text: "1234" }, d);
    expect(r.state.step).toBe("ASK_MOBILE"); // invalid number asks again
    r = await handleMessage(ctx({ privacyConsent: true }), r.state, { text: "0917 123 4567" }, d);
    expect(d.saveMobile).toHaveBeenCalledWith("09171234567");
    expect(r.state.step).toBe("ASK_EMAIL");
    expect(d.book).not.toHaveBeenCalled();
    r = await handleMessage(ctx(), r.state, { text: "ana@gmail" }, d);
    expect(r.state.step).toBe("ASK_EMAIL"); // invalid email asks again
    r = await handleMessage(ctx(), r.state, { text: "Ana.Santos@Gmail.com" }, d);
    expect(d.saveEmail).toHaveBeenCalledWith("ana.santos@gmail.com");
    expect(d.book).toHaveBeenCalled();
    expect(r.state.step).toBe("IDLE");
    expect(r.replies[0].text).toContain("Confirmed na po");
  });

  it("books without an email when the patient has none", async () => {
    const d = deps();
    const state: FlowState = { step: "ASK_EMAIL", typeId: "t1", startAt: "2026-11-03T02:00:00.000Z" };
    const r = await handleMessage(ctx({ hasFullName: true, mobile: "09171234567" }), state, { payload: "EMAIL_SKIP" }, d);
    expect(d.saveEmail).not.toHaveBeenCalled();
    expect(d.book).toHaveBeenCalled();
  });

  it("skips questions already answered on the lead", async () => {
    const d = deps();
    const state: FlowState = { step: "PICK_SLOT", typeId: "t1", page: 0 };
    const r = await handleMessage(ctx({ hasFullName: true, mobile: "09171234567", email: "a@b.co" }), state, { payload: "SLOT:2026-11-03T02:00:00.000Z" }, d);
    expect(d.book).toHaveBeenCalled();
    expect(r.state.step).toBe("IDLE");
  });

  it("offers slots again when the chosen time was just taken", async () => {
    const d = deps({ book: vi.fn(async () => ({ ok: false as const })) });
    const state: FlowState = { step: "PICK_SLOT", typeId: "t1", page: 0 };
    const r = await handleMessage(ctx({ privacyConsent: true, hasFullName: true, mobile: "09171234567", email: "a@b.co" }), state, { payload: "SLOT:2026-11-03T02:00:00.000Z" }, d);
    expect(r.replies[0].text).toContain("may nauna nang nag-book");
    expect(r.state.step).toBe("PICK_SLOT");
  });

  it("confirms an upcoming appointment when the patient replies OK", async () => {
    const d = deps();
    const upcoming = { id: "a1", status: "BOOKED", dateLabel: "Tue, Nov 3", timeLabel: "10:00 AM" };
    const r = await handleMessage(ctx({ upcoming }), IDLE, { text: "OK po" }, d);
    expect(d.confirmAppointment).toHaveBeenCalledWith("a1");
    expect(r.replies[0].text).toContain("Confirmed na");
  });

  it("starts a reschedule for RESCHED replies", async () => {
    const upcoming = { id: "a1", status: "CONFIRMED", dateLabel: "Tue, Nov 3", timeLabel: "10:00 AM" };
    const r = await handleMessage(ctx({ upcoming, privacyConsent: true }), IDLE, { text: "RESCHED" }, deps());
    expect(r.state).toMatchObject({ step: "PICK_SLOT", rescheduleId: "a1" });
  });
});

describe("helpers", () => {
  it("normalizes PH mobile numbers", () => {
    expect(normalizePhMobile("+63 917-123-4567")).toBe("09171234567");
    expect(normalizePhMobile("9171234567")).toBe("09171234567");
    expect(normalizePhMobile("02 8123 4567")).toBeNull();
  });
  it("detects Taglish intents", () => {
    expect(detectIntent("saan po location nyo")).toBe("MENU_LOCATION");
    expect(detectIntent("pa-book po")).toBe("MENU_BOOK");
    expect(detectIntent("may sakit ako")).toBeNull();
  });

  it("adds no privacy notice of its own", async () => {
    const r = await handleMessage(ctx({ isNewConversation: true, scripts: { first_reply: "Hi {first_name}!" } }), IDLE, { text: "hi" }, deps());
    expect(r.replies.map((x) => x.text).join("\n")).not.toContain("privacy");
  });
});
