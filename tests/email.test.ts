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

import { vi } from "vitest";
import { sendBrevo } from "../src/lib/email";

describe("Brevo email API", () => {
  it("sends as the clinic sender and explains an unverified sender", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return calls.length === 1
        ? new Response(JSON.stringify({ messageId: "x" }), { status: 201 })
        : new Response(JSON.stringify({ message: "Sender is not valid" }), { status: 400 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const cfg = { apiKey: "xkeysib-abc", from: "doctor@clinicamedica101.org", fromName: "Clinica Medica 101" };
    expect(await sendBrevo(cfg, "p@x.co", "Paalala", "Hi")).toEqual({ ok: true });
    expect(calls[0].url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(calls[0].body).toMatchObject({ sender: { email: "doctor@clinicamedica101.org" }, to: [{ email: "p@x.co" }] });
    const r = await sendBrevo(cfg, "p@x.co", "Paalala", "Hi");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Hindi pa verified");
    vi.unstubAllGlobals();
  });
});
