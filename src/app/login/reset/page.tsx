import { redirect } from "next/navigation";
import { checkResetToken, completePasswordReset } from "@/lib/password-reset";

async function reset(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const result = await completePasswordReset({
    token,
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
    code: String(formData.get("code") ?? "") || undefined,
  });
  if (result === "ok") redirect("/login?reset=1");
  if (result === "invalid") redirect("/login/reset?error=invalid");
  redirect(`/login/reset?token=${encodeURIComponent(token)}&error=${result}`);
}

const ERRORS: Record<string, string> = {
  short: "Dapat 12 characters o higit pa ang password.",
  mismatch: "Hindi magkapareho ang dalawang password.",
  code: "Mali ang 2FA code. Subukan ulit.",
};

export const metadata = { referrer: "no-referrer" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const check = await checkResetToken(token);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      {!check ? (
        <div className="card w-full max-w-sm space-y-4">
          <h1>Hindi na gumagana ang link</h1>
          <p className="text-sm text-slate-700">Nagamit na, nag-expire (30 minuto), o mali ang link. Humingi ng bago.</p>
          <a href="/login/forgot" className="btn block w-full text-center">Humingi ng bagong link</a>
        </div>
      ) : (
        <form action={reset} className="card w-full max-w-sm space-y-4">
          <h1>Pumili ng bagong password</h1>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[error] ?? ERRORS.short}</p>}
          <input type="hidden" name="token" value={token} />
          <input name="next" type="password" className="input" placeholder="Bagong password (12+ characters)" minLength={12} autoComplete="new-password" required />
          <input name="confirm" type="password" className="input" placeholder="Ulitin ang bagong password" minLength={12} autoComplete="new-password" required />
          {check.needs2fa && (
            <div>
              <label className="label" htmlFor="code">2FA code</label>
              <input className="input text-center tracking-widest" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code mula sa authenticator" required />
              <p className="muted mt-1 text-xs">Nawala ang phone? Owner ang magre-reset ng 2FA mo (o ang server script kung Owner ka).</p>
            </div>
          )}
          <button className="btn w-full">I-save ang password</button>
        </form>
      )}
    </main>
  );
}
