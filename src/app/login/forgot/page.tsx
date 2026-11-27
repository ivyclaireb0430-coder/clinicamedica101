import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/password-reset";

async function request(formData: FormData) {
  "use server";
  await requestPasswordReset(String(formData.get("email") ?? ""));
  redirect("/login/forgot?sent=1");
}

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={request} className="card w-full max-w-sm space-y-4">
        <h1>Nakalimutan ang password</h1>
        {sent ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Kung may account ang email na iyan, may darating na reset link sa loob ng ilang minuto. Tingnan din ang Spam.
            Gumagana ang link nang 30 minuto lang.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              Ilagay ang email ng account mo. Padadalhan ka namin ng link para pumili ng bagong password.
            </p>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="username" required />
            </div>
            <button className="btn w-full">Ipadala ang reset link</button>
          </>
        )}
        <p className="muted text-xs">
          Walang dumating na email? Staff: sabihan ang Owner, ire-reset niya sa Users &amp; roles. Owner: gamitin ang reset
          script sa server (DEPLOY.md).
        </p>
        <a href="/login" className="block text-center text-sm underline">Bumalik sa login</a>
      </form>
    </main>
  );
}
