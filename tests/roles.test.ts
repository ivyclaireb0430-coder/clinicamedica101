import { describe, expect, it } from "vitest";
import { can } from "@/lib/roles";

describe("role permissions", () => {
  it("never lets front desk see clinical or health info", () => {
    expect(can("FRONT_DESK", "clinical:read")).toBe(false);
    expect(can("FRONT_DESK", "lead_concern:read")).toBe(false);
    expect(can("FRONT_DESK", "booking:write")).toBe(true);
  });
  it("gives owner full access and doctor clinical access", () => {
    expect(can("OWNER", "users:manage")).toBe(true);
    expect(can("DOCTOR", "clinical:write")).toBe(true);
    expect(can("DOCTOR", "users:manage")).toBe(false);
  });
  it("lets front desk handle payments but not void them, see reports, or read feedback", () => {
    expect(can("FRONT_DESK", "billing:write")).toBe(true);
    expect(can("FRONT_DESK", "billing:void")).toBe(false);
    expect(can("FRONT_DESK", "reports:read")).toBe(false);
    expect(can("FRONT_DESK", "feedback:read")).toBe(false);
    expect(can("OWNER", "billing:void")).toBe(true);
  });
  it("denies unknown roles", () => {
    expect(can("ADMIN", "leads:read")).toBe(false);
    expect(can(undefined, "leads:read")).toBe(false);
  });
});
