// Forgot your password (or lost your 2FA phone)? Run on the server to set a new temporary password.
// Usage: npm run reset-password -- doctor@gmail.com [--reset-2fa]
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const reset2fa = args.includes("--reset-2fa");
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  if (!email) {
    const users = await db.user.findMany({ select: { email: true, role: true, active: true }, orderBy: { createdAt: "asc" } });
    console.error("Usage: reset-password <email> [--reset-2fa]\nUsers:");
    for (const u of users) console.error(`  ${u.email} (${u.role}${u.active ? "" : ", inactive"})`);
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error("No user with that email. Run without an email to list users.");
    process.exit(1);
  }
  const password = randomBytes(12).toString("base64url");
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
      failedLogins: 0,
      lockedUntil: null,
      ...(reset2fa ? { totpEnabled: false, totpSecretEnc: null } : {}),
    },
  });
  const detail = reset2fa ? "password and 2FA reset from server" : "password reset from server";
  await db.auditLog.create({ data: { userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, detail } }).catch(() => undefined);
  console.log(`New temporary password for ${email} (shown once): ${password}`);
  console.log("Log in with it. The app will ask you to choose a new password right away.");
  if (reset2fa) console.log("2FA is now off. Owners are asked to scan a new QR code after logging in.");
  else if (user.totpEnabled) console.log("2FA stays on: you still need the 6-digit code. Lost the phone? Run again with --reset-2fa.");
}

main().finally(() => db.$disconnect());
