import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";
import { decrypt } from "./lib/crypto";
import { verifyTotp } from "./lib/totp";
import { audit } from "./lib/audit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
  code: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, code } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        let totpOk = true;
        if (passwordOk && user.totpEnabled && user.totpSecretEnc) {
          totpOk = Boolean(code) && verifyTotp(code ?? "", decrypt(user.totpSecretEnc));
        }

        if (!passwordOk || !totpOk) {
          const failed = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed >= MAX_FAILED ? 0 : failed,
              lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          await audit({ userId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id });
          return null;
        }

        await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
        await audit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });
        return { id: user.id, name: user.name, email: user.email, role: user.role, totpEnabled: user.totpEnabled };
      },
    }),
  ],
});

/**
 * Explains why a sign-in can't proceed, for a friendlier message on the login page.
 * Only reveals the 2FA step after a correct password; never counts as a failed attempt.
 */
export async function loginHint(email: string, password: string, code?: string): Promise<"locked" | "2fa_required" | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return null;
  if (user.lockedUntil && user.lockedUntil > new Date()) return "locked";
  if (user.totpEnabled && !code && (await bcrypt.compare(password, user.passwordHash))) return "2fa_required";
  return null;
}
