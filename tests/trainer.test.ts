import { describe, expect, it } from "vitest";
import { factsText, replyProblems, type ClinicFacts } from "@/lib/messenger/ai";
import { buildTrainerContent, cleanLessons } from "@/lib/messenger/trainer";

const base: ClinicFacts = {
  clinicName: "Clinic", address: "Makati", phone: "", hours: "Mon-Sat", hoursEn: "Mon-Sat", doctorName: "Dr. A",
  consultationTypes: [{ name: "Consultation", feeLabel: "₱1,000" }], feeNote: "", offer: "", promo: null, services: "", faq: "", scripts: {},
};

describe("AI lessons (Turuan ang AI)", () => {
  it("adds owner facts and rules to the clinic facts", () => {
    const f = factsText({ ...base, lessons: [{ kind: "FACT", text: "Tumatanggap kami ng GCash." }, { kind: "RULE", text: "Laging magtanong muna ng concern." }] });
    expect(f).toContain("More clinic facts from the owner:\n- Tumatanggap kami ng GCash.");
    expect(f).toContain("medical safety rules always come first):\n- Laging magtanong muna ng concern.");
    expect(factsText(base)).not.toContain("from the owner");
  });

  it("lets a taught price through the reply price check", () => {
    const f = factsText({ ...base, lessons: [{ kind: "FACT", text: "Senior discount: ₱800 ang consultation." }] });
    expect(replyProblems("₱800 po para sa senior.", f)).toEqual([]);
    expect(replyProblems("₱800 po para sa senior.", factsText(base))).not.toEqual([]);
  });

  it("cleans suggested lessons: trims, masks contacts, drops duplicates and known ones", () => {
    const known = factsText({ ...base, lessons: [{ kind: "FACT", text: "May parking sa basement." }] });
    const out = cleanLessons(
      [
        { kind: "FACT", text: "  Tumatanggap   kami ng GCash. " },
        { kind: "FACT", text: "tumatanggap kami ng gcash." },
        { kind: "FACT", text: "May parking sa basement." },
        { kind: "RULE", text: "Tawagan sa 0917 123 4567 kung urgent." },
        { kind: "RULE", text: "ok" },
      ],
      known,
    );
    expect(out).toEqual([
      { kind: "FACT", text: "Tumatanggap kami ng GCash." },
      { kind: "RULE", text: "Tawagan sa [mobile] kung urgent." },
    ]);
  });

  it("builds the trainer prompt with knowledge and the owner conversation", () => {
    const c = buildTrainerContent("FACTS", [{ from: "owner", text: "Ano alam mo?" }, { from: "ai", text: "Ito po" }]);
    expect(c).toContain("<current_knowledge>\nFACTS\n</current_knowledge>");
    expect(c).toContain("Owner: Ano alam mo?\nYou: Ito po");
  });
});
