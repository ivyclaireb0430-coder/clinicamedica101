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
