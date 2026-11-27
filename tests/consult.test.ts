import { describe, expect, it, vi } from "vitest";
import {
  SAFE_FALLBACK,
  ageFromBirthDate,
  buildConsultContent,
  consultReplyProblems,
  dangerousDrug,
  decideConsultReply,
  isConsultEmergency,
  lessonsText,
  medicineProblems,
  type ConsultProfile,
} from "@/lib/consult/ai";
import { cleanDocLessons, editLessonStarter } from "@/lib/consult/trainer";
import { handleMessage, menu, type BotContext, type BotDeps } from "@/lib/messenger/bot";
import { SCRIPTS } from "../prisma/seed-data";

const profile: ConsultProfile = {
  doctorName: "Dr. Irene Lim",
  clinicName: "Clinica Medica 101",
  patient: { firstName: "Ana", age: 34, sex: "FEMALE" },
  lessons: [
    { kind: "STYLE", text: "Laging nagsisimula sa 'Kumusta po kayo?'" },
    { kind: "QUESTION", text: "Sa may ubo: tanungin kung may plema at anong kulay" },
  ],
};

describe("online konsulta safety", () => {
  it("routes emergencies in Tagalog, Taglish and English away from the AI", () => {
    for (const t of [
      "hirap po akong huminga",
      "masakit ang dibdib ko, naninikip ang dibdib",
      "nagsusuka ng dugo po ako",
      "buntis po ako at nagdurugo",
      "ayoko nang mabuhay",
      "I think I want to die",
      "nangingisay po yung anak ko",
      "namamaga ang lalamunan ko after kumain ng hipon",
    ])
      expect(isConsultEmergency(t), t).toBe(true);
    for (const t of ["3 araw na po akong may ubo at sipon", "masakit po ang tuhod ko pag umaakyat", "nahihirapan po akong matulog"])
      expect(isConsultEmergency(t), t).toBe(false);
  });

  it("blocks medicine names, doses, diagnosis guesses and promises in patient replies", () => {
    expect(consultReplyProblems("Puwede po kayong uminom ng paracetamol.")).not.toHaveLength(0);
    expect(consultReplyProblems("Take 500 mg every 8 hours.")).not.toHaveLength(0);
    expect(consultReplyProblems("Mukhang may UTI kayo, baka may impeksyon.")).not.toHaveLength(0);
    expect(consultReplyProblems("Siguradong gagaling kayo agad!")).not.toHaveLength(0);
    expect(consultReplyProblems("Amoxicillin po ang kailangan")).not.toHaveLength(0);
    expect(consultReplyProblems("Losartan po ba ang maintenance ninyo?")).not.toHaveLength(0);
    expect(consultReplyProblems("Tingnan ninyo ito: https://example.com")).not.toHaveLength(0);
  });

  it("lets normal history-taking replies through", () => {
    for (const t of [
      "Salamat po sa pagkuwento. Kailan po ito nagsimula, at gaano kasakit mula 0 hanggang 10?",
      "May iniinom po ba kayong maintenance na gamot o supplements? Paki-lista lang po.",
      "Si Dr. Irene Lim po mismo ang magbibigay ng assessment at reseta kapag na-review niya ito.",
    ])
      expect(consultReplyProblems(t), t).toEqual([]);
  });

  it("never sends an emergency message to the AI", async () => {
    const call = vi.fn();
    const d = await decideConsultReply({ text: "hindi po ako makahinga", profile, history: [], apiKey: "k" }, call);
    expect(d.kind).toBe("emergency");
    expect(d.reply).toMatch(/911/);
    expect(call).not.toHaveBeenCalled();
  });

  it("uses the model's own emergency flag, the filter, and a safe line on failure", async () => {
    const emergency = await decideConsultReply({ text: "medyo masama pakiramdam", profile, history: [], apiKey: "k" }, async () => ({ reply: "x", readyForDoctor: false, emergency: true }));
    expect(emergency.kind).toBe("emergency");
    const filtered = await decideConsultReply({ text: "ano po iinumin ko", profile, history: [], apiKey: "k" }, async () => ({ reply: "Uminom po kayo ng ibuprofen 400 mg.", readyForDoctor: false, emergency: false }));
    expect(filtered).toEqual({ kind: "reply", reply: SAFE_FALLBACK, readyForDoctor: false, filtered: true });
    const failed = await decideConsultReply({ text: "ubo po", profile, history: [], apiKey: "k" }, async () => null);
    expect(failed.kind).toBe("failed");
    const ok = await decideConsultReply({ text: "ubo po", profile, history: [], apiKey: "k" }, async () => ({ reply: "Kumusta po kayo? May plema po ba?", readyForDoctor: true, emergency: false }));
    expect(ok).toEqual({ kind: "reply", reply: "Kumusta po kayo? May plema po ba?", readyForDoctor: true, filtered: false });
  });

  it("gives the AI the doctor's style and masks contacts", () => {
    const content = buildConsultContent(profile, [{ from: "patient", text: "text me at 0917 123 4567 or ana@mail.com" }]);
    expect(content).toContain("Kumusta po kayo?");
    expect(content).toContain("plema");
    expect(content).toContain("34 years old");
    expect(content).not.toContain("0917");
    expect(content).not.toContain("ana@mail.com");
    expect(lessonsText([])).toBe("");
  });

  it("never learns medicines or doses, and dedupes", () => {
    const out = cleanDocLessons(
      [
        { kind: "ADVICE", text: "Uminom ng maraming tubig at magpahinga" },
        { kind: "ADVICE", text: "Para sa lagnat, paracetamol 500 mg" },
        { kind: "STYLE", text: "Laging nagsisimula sa 'Kumusta po kayo?'" },
        { kind: "QUESTION", text: "Itanong kung ilang oras ang tulog" },
        { kind: "QUESTION", text: "itanong kung ilang oras ang tulog" },
      ],
      profile.lessons,
    );
    expect(out.map((l) => l.text)).toEqual(["Uminom ng maraming tubig at magpahinga", "Itanong kung ilang oras ang tulog"]);
    expect(medicineProblems("Uminom ng maraming tubig")).toEqual([]);
  });

  it("removes the patient's name from 'learn from my edit'", () => {
    const t = editLessonStarter("Hi Ana, salamat po.", "Hello Ana Santos! Kumusta po? 0917 123 4567", ["Ana", "Santos"]);
    expect(t).not.toMatch(/Ana|Santos|0917/);
    expect(t).toContain("[pangalan]");
  });

  it("refuses dangerous drugs on the e-reseta", () => {
    expect(dangerousDrug([{ drug: "Alprazolam", form: "0.25 mg tab" }])).toBe("Alprazolam");
    expect(dangerousDrug([{ drug: "Cetirizine", form: "10 mg tab" }])).toBeNull();
  });

  it("computes age in Manila dates", () => {
    expect(ageFromBirthDate("1990-11-26", "2026-11-25")).toBe(35);
    expect(ageFromBirthDate("1990-11-25", "2026-11-25")).toBe(36);
    expect(ageFromBirthDate(null, "2026-11-25")).toBeNull();
  });
});

describe("Messenger link to online konsulta", () => {
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
  const deps = (): BotDeps => ({
    slots: vi.fn(async () => ({ slots: [], hasMore: false })),
    book: vi.fn(async () => ({ ok: false as const })),
    confirmAppointment: vi.fn(async () => {}),
    recordConsent: vi.fn(async () => {}),
    saveName: vi.fn(async () => {}),
    saveMobile: vi.fn(async () => {}),
    handoff: vi.fn(async () => {}),
    setStage: vi.fn(async () => {}),
  });

  it("adds the menu item only when the konsulta is open", () => {
    expect(menu(ctx()).some((q) => q.payload === "MENU_CONSULT")).toBe(false);
    expect(menu(ctx({ consultUrl: "https://x.test/konsulta?m=t" })).some((q) => q.payload === "MENU_CONSULT")).toBe(true);
  });

  it("sends the konsulta button and says the doctor prescribes", async () => {
    const r = await handleMessage(ctx({ consultUrl: "https://x.test/konsulta?m=t", doctorName: "Dr. Irene Lim" }), { step: "IDLE" }, { payload: "MENU_CONSULT" }, deps());
    expect(r.replies[0].button?.url).toBe("https://x.test/konsulta?m=t");
    expect(r.replies[0].text).toMatch(/AI assistant po ni Dr\. Irene Lim/);
    expect(r.replies[0].text).toMatch(/reseta/);
  });

  it("offers the konsulta after a health hand-off", async () => {
    const d = deps();
    const r = await handleMessage(ctx({ consultUrl: "https://x.test/konsulta?m=t" }), { step: "IDLE" }, { text: "masakit tiyan ko tuwing gabi" }, d);
    expect(d.handoff).toHaveBeenCalled();
    expect(r.replies.at(-1)?.button?.url).toBe("https://x.test/konsulta?m=t");
  });
});
