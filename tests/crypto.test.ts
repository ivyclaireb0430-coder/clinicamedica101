import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "@/lib/crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("field encryption", () => {
  it("round-trips and does not store plaintext", () => {
    const stored = encrypt("Sakit ng ulo");
    expect(stored).not.toContain("Sakit");
    expect(decrypt(stored)).toBe("Sakit ng ulo");
  });
  it("uses a fresh IV each time", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });
  it("detects tampering", () => {
    const parts = encrypt("secret").split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});
