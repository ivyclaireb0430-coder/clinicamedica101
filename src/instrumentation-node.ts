import { envProblems } from "@/lib/env-check";

export async function registerNode() {
  if (process.env.NODE_ENV !== "production") return;
  // Refuse to run in production with missing or weak secrets.
  const problems = envProblems(process.env);
  if (problems.length) {
    console.error(`Server settings problem:\n- ${problems.join("\n- ")}\nSee docs/DEPLOY.md.`);
    process.exit(1);
  }
  // Facebook keys saved in Settings (when not in clinic.env).
  try {
    const { fieldsFromServer, applyStoredMetaCreds } = await import("@/lib/messenger/meta-creds");
    fieldsFromServer();
    await applyStoredMetaCreds();
  } catch (err) {
    console.error("Could not load Facebook keys from Settings:", (err as Error).message);
  }
}
