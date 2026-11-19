import { describe, expect, it } from "vitest";
import { explainSmtpError, sendSmtp } from "../src/lib/email";

describe("clinic email (SMTP)", () => {
  it("explains common SMTP failures in plain words", () => {
    expect(explainSmtpError({ code: "EAUTH", responseCode: 535 })).toContain("Mali ang email o password");
    expect(explainSmtpError({ response: "535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant." })).toContain("Naka-off ang SMTP");
    expect(explainSmtpError({ code: "ECONNECTION" })).toContain("Hindi maabot");
  });

  it("returns an error instead of throwing when the server can't be reached", async () => {
    const r = await sendSmtp({ host: "127.0.0.1", port: 1, security: "starttls", user: "a@b.co", pass: "x", fromName: "Test" }, "c@d.co", "s", "t");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
