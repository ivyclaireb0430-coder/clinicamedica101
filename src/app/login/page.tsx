import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { loginHint, signIn } from "@/auth";

const MESSAGES: Record<string, string> = {
  invalid: "Mali ang email, password, o 2FA code.",
  "2fa_required": "Ilagay ang 6-digit code mula sa authenticator app.",
  locked: "Masyadong maraming maling subok. Subukan ulit pagkalipas ng 15 minuto.",
};

async function login(formData: FormData) {
  "use server";
  const hint = await loginHint(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""), String(formData.get("code") ?? "") || undefined);
  if (hint) redirect(`/login?error=${hint}`);
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      code: formData.get("code") || undefined,
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?error=invalid");
    throw err;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; enabled?: string }> }) {
  const { error, enabled } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="card w-full max-w-sm space-y-4">
        <div>
          <h1>Clinica Medica 101</h1>
          <p className="muted">Sign in to the clinic system</p>
        </div>
        {enabled && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Naka-on na ang 2FA. Mag-login ulit gamit ang code.</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{MESSAGES[error] ?? MESSAGES.invalid}</p>}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <div>
          <label className="label" htmlFor="code">2FA code</label>
          <input className="input" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits (if 2FA is on)" />
        </div>
        <button className="btn w-full" type="submit">Sign in</button>
      </form>
    </main>
  );
}
