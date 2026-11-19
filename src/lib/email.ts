import nodemailer from "nodemailer";
import { decryptJson, encryptJson } from "./crypto";
import { getSetting, setSetting } from "./settings";
import { sendGmail } from "./google";

// Outgoing email for patient reminders and staff notices. Uses the clinic's own mailbox over SMTP when set up
// (e.g. doctor@clinicamedica101.org on GoDaddy), otherwise the connected Google account (Gmail API).

export type SmtpConfig = {
  host: string;
  port: number;
  /** "ssl" = TLS from the start (port 465); "starttls" = upgrade after connecting (port 587). */
  security: "ssl" | "starttls";
  user: string;
  pass: string;
  fromName: string;
};

/** Common GoDaddy setups. GoDaddy "Professional Email (Microsoft 365)" uses Outlook's server. */
export const SMTP_PRESETS: Record<string, { label: string; host: string; port: number; security: SmtpConfig["security"] }> = {
  godaddy365: { label: "GoDaddy Microsoft 365 (Outlook)", host: "smtp.office365.com", port: 587, security: "starttls" },
  godaddy: { label: "GoDaddy Workspace / Professional Email (secureserver)", host: "smtpout.secureserver.net", port: 465, security: "ssl" },
};

export async function loadSmtp(): Promise<SmtpConfig | null> {
  const cfg = decryptJson<SmtpConfig>(await getSetting("smtpConfigEnc"));
  return cfg && cfg.host && cfg.user && cfg.pass ? cfg : null;
}

export async function saveSmtp(cfg: SmtpConfig | null): Promise<void> {
  await setSetting("smtpConfigEnc", cfg ? encryptJson(cfg) : "");
}

function transportFor(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === "ssl",
    requireTLS: cfg.security === "starttls",
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

/** Turns SMTP errors into a short reason staff can act on. */
export function explainSmtpError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; response?: string; message?: string };
  const text = `${e.response ?? ""} ${e.message ?? ""}`;
  if (/SmtpClientAuthentication is disabled|5\.7\.139/i.test(text)) {
    return "Naka-off ang SMTP sa Microsoft 365 account na ito. Kailangang i-on ang 'Authenticated SMTP' para sa mailbox (sa GoDaddy/Microsoft 365 admin).";
  }
  if (e.code === "EAUTH" || e.responseCode === 535) return "Mali ang email o password (o kailangan ng app password).";
  if (e.code === "ETIMEDOUT" || e.code === "ECONNECTION" || e.code === "ESOCKET") return "Hindi maabot ang mail server. I-check ang server at port.";
  return (e.message ?? "SMTP error").slice(0, 200);
}

export async function sendSmtp(cfg: SmtpConfig, to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await transportFor(cfg).sendMail({ from: { name: cfg.fromName || "Clinica Medica 101", address: cfg.user }, to, subject, text });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: explainSmtpError(err) };
  }
}

/** Send an email: clinic mailbox (SMTP) first, else the connected Google account. */
export async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const smtp = await loadSmtp();
  if (smtp) return sendSmtp(smtp, to, subject, text);
  return sendGmail(to, subject, text);
}
