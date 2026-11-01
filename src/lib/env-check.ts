/** Problems with the production environment (pure; unit-tested). Empty array = OK. */
export function envProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  for (const k of ["DATABASE_URL", "AUTH_SECRET", "ENCRYPTION_KEY", "APP_URL", "CRON_SECRET"]) {
    if (!env[k]) problems.push(`${k} is not set`);
  }
  if (env.ENCRYPTION_KEY && Buffer.from(env.ENCRYPTION_KEY, "base64").length !== 32) problems.push("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) problems.push("AUTH_SECRET is too short (use openssl rand -base64 32)");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 24) problems.push("CRON_SECRET is too short");
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(env.APP_URL ?? ""); // `next start` on your own computer
  if (env.APP_URL && !env.APP_URL.startsWith("https://") && !local) problems.push("APP_URL must start with https:// in production");
  if (env.DATABASE_URL && !env.DATABASE_URL.startsWith("postgres")) problems.push("DATABASE_URL must be a PostgreSQL URL");
  return problems;
}
