import { describe, expect, it } from "vitest";
import { SCRIPTS } from "../prisma/seed-data";

describe("saved scripts content", () => {
  it("uses only supported placeholders and makes no outcome promises", () => {
    for (const s of SCRIPTS) {
      for (const [, key] of s.body.matchAll(/\{(\w+)\}/g)) expect(["first_name", "date", "time"]).toContain(key);
      expect(s.body.toLowerCase()).not.toMatch(/guarantee|garantisado|siguradong gagaling|cure|lunas/);
    }
  });
});

import { unfilledBlanks } from "../src/lib/scripts";

describe("unfilledBlanks", () => {
  it("finds [bracketed] blanks the clinic still has to fill", () => {
    expect(unfilledBlanks("Fee po ay ₱[fee], mga [minutes] minuto. Link: [link] [fee]")).toEqual(["[fee]", "[minutes]", "[link]"]);
    expect(unfilledBlanks("Fee po ay ₱2,500.")).toEqual([]);
  });
});
