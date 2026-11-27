import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

async function setPassword(formData: FormData) {
  "use server";
  const user = await requireUser();
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 12) redirect("/change-password?error=short");
  if (next !== confirm) redirect("/change-password?error=mismatch");
  if (await bcrypt.compare(next, user.passwordHash)) redirect("/change-password?error=same");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false } });
  await audit({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, detail: "temporary password replaced" });
  redirect("/");
}

const ERRORS: Record<string, string> = {
  short: "Dapat 12 characters o higit pa.",
  mismatch: "Hindi magkapareho ang dalawang password.",
  same: "Pumili ng bago, hindi ang temporary password.",
};

export default async function ChangePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={setPassword} className="card w-full max-w-sm space-y-4">
        <h1>Gumawa ng bagong password</h1>
        <p className="text-sm text-slate-700">
          Temporary password ang ginamit mo. Pumili ng sarili mong password (12+ characters) bago magpatuloy. Itago ito sa
          password manager.
        </p>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[error] ?? ERRORS.short}</p>}
        <input name="next" type="password" className="input" placeholder="Bagong password (12+ characters)" minLength={12} autoComplete="new-password" required />
        <input name="confirm" type="password" className="input" placeholder="Ulitin ang bagong password" minLength={12} autoComplete="new-password" required />
        <button className="btn w-full">I-save ang password</button>
      </form>
    </main>
  );
}
