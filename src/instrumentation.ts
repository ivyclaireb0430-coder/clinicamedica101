import { envProblems } from "@/lib/env-check";

// Runs once when the server starts. Refuse to run in production with missing or weak secrets.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const problems = envProblems(process.env);
  if (problems.length) {
    console.error(`Server settings problem:\n- ${problems.join("\n- ")}\nSee docs/DEPLOY.md.`);
    process.exit(1);
  }
}
