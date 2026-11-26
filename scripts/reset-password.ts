// Forgot your password? Run on the server to set a new temporary password. 2FA stays as it is.
// Usage: npm run reset-password -- doctor@gmail.com
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    const users = await db.user.findMany({ select: { email: true, role: true, active: true }, orderBy: { createdAt: "asc" } });
    console.error("Usage: reset-password <email>\nUsers:");
    for (const u of users) console.error(`  ${u.email} (${u.role}${u.active ? "" : ", inactive"})`);
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error("No user with that email. Run without an email to list users.");
    process.exit(1);
  }
  const password = randomBytes(12).toString("base64url");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null } });
  await db.auditLog.create({ data: { userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, detail: "password reset from server" } }).catch(() => undefined);
  console.log(`New temporary password for ${email} (shown once): ${password}\nLog in with it, then change it in More → Users & roles.`);
}

main().finally(() => db.$disconnect());
