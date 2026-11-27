import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { audit } from "./audit";
import { decrypt } from "./crypto";
import { verifyTotp } from "./totp";
import { sendEmail } from "./email";

// Self-service "Forgot password?" from the login page. The link goes to the account's email; 2FA is still required
// when it is on, so a stolen mailbox alone can't take over the account.

export const RESET_TTL_MINUTES = 30;
export const MAX_RESETS_PER_HOUR = 3;
export const MIN_PASSWORD_LENGTH = 12;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function isTokenUsable(t: { expiresAt: Date; usedAt: Date | null } | null, now = new Date()): boolean {
  return Boolean(t && !t.usedAt && t.expiresAt > now);
}

export function resetEmailText(name: string, link: string): string {
  return [
    `Hi ${name},`,
    "",
    "May humiling na i-reset ang password mo sa Clinica Medica 101.",
    `Buksan ang link na ito sa loob ng ${RESET_TTL_MINUTES} minuto para pumili ng bagong password:`,
    "",
    link,
    "",
    "Kung hindi ikaw ang humiling, huwag pansinin ang email na ito. Hindi magbabago ang password mo.",
    "Huwag i-forward ang link na ito kahit kanino.",
  ].join("\n");
}

/**
 * Sends a reset link if the email belongs to an active user. Always resolves the same way so the login page
 * never reveals whether an email has an account.
 */
export async function requestPasswordReset(rawEmail: string, appUrl = process.env.APP_URL ?? ""): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  if (!email) return;
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) return;
  const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
  if (recent >= MAX_RESETS_PER_HOUR) return;
  const { token, tokenHash } = newResetToken();
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) } });
  const sent = await sendEmail(user.email, "I-reset ang password mo (Clinica Medica 101)", resetEmailText(user.name, `${appUrl}/login/reset?token=${token}`)).catch(() => ({ ok: false }));
  await audit({ userId: user.id, action: "PASSWORD_RESET_REQUESTED", entity: "User", entityId: user.id, detail: sent.ok ? "email sent" : "email failed" });
}

/** Looks up a reset link; returns whether 2FA is needed, or null if the link is invalid, used or expired. */
export async function checkResetToken(token: string): Promise<{ needs2fa: boolean } | null> {
  if (!token) return null;
  const t = await db.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) }, include: { user: true } });
  if (!t || !isTokenUsable(t) || !t.user.active) return null;
  return { needs2fa: t.user.totpEnabled && Boolean(t.user.totpSecretEnc) };
}

export type ResetResult = "ok" | "invalid" | "short" | "mismatch" | "code";

export async function completePasswordReset(input: { token: string; next: string; confirm: string; code?: string }): Promise<ResetResult> {
  const t = input.token
    ? await db.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(input.token) }, include: { user: true } })
    : null;
  if (!t || !isTokenUsable(t) || !t.user.active) return "invalid";
  if (input.next.length < MIN_PASSWORD_LENGTH) return "short";
  if (input.next !== input.confirm) return "mismatch";
  const user = t.user;
  if (user.totpEnabled && user.totpSecretEnc && !verifyTotp(input.code ?? "", decrypt(user.totpSecretEnc))) {
    await audit({ userId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id, detail: "wrong 2FA code on password reset" });
    return "code";
  }
  // Claim the token first so the same link can't be used twice at the same moment.
  const claimed = await db.passwordResetToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return "invalid";
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(input.next, 12), mustChangePassword: false, failedLogins: 0, lockedUntil: null },
  });
  // Any other outstanding links stop working.
  await db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await audit({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, detail: "password reset via email link" });
  return "ok";
}
