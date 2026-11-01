// Create the first Owner account on a fresh server (the demo seed never runs in production).
// Usage: npm run create-owner -- doctor@gmail.com "Dr. Juan Dela Cruz"
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();
  if (!email || !email.includes("@") || !name) {
    console.error('Usage: npm run create-owner -- <email> "<full name>"');
    process.exit(1);
  }
  if (await db.user.findUnique({ where: { email: email.toLowerCase() } })) {
    console.error("A user with that email already exists.");
    process.exit(1);
  }
  const password = randomBytes(12).toString("base64url");
  await db.user.create({
    data: { email: email.toLowerCase(), name, role: "OWNER", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Owner created: ${email}\nTemporary password (shown once): ${password}\nOn first login you will set up 2FA. Then change this password in More → Users & roles.`);
}

main().finally(() => db.$disconnect());
