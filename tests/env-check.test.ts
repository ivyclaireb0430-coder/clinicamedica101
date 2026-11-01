import { describe, expect, it } from "vitest";
import { envProblems } from "@/lib/env-check";

const good = {
  DATABASE_URL: "postgresql://clinic:x@localhost:5432/clinic",
  AUTH_SECRET: "a".repeat(44),
  ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  APP_URL: "https://app.clinicamedica101.org",
  CRON_SECRET: "b".repeat(40),
};

describe("production settings check", () => {
  it("accepts a complete setup", () => expect(envProblems(good)).toEqual([]));
  it("allows plain http only for localhost", () => {
    expect(envProblems({ ...good, APP_URL: "http://localhost:3000" })).toEqual([]);
    expect(envProblems({ ...good, APP_URL: "http://localhost.evil.com" })).toContain("APP_URL must start with https:// in production");
  });
  it("flags missing and weak values", () => {
    const p = envProblems({ ...good, ENCRYPTION_KEY: "short", APP_URL: "http://x", CRON_SECRET: undefined });
    expect(p).toContain("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    expect(p).toContain("APP_URL must start with https:// in production");
    expect(p).toContain("CRON_SECRET is not set");
  });
});
