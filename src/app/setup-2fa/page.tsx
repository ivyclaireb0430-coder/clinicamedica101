import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { newTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { audit } from "@/lib/audit";
import { signOut } from "@/auth";

async function enable(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user.totpSecretEnc) redirect("/setup-2fa");
  if (!verifyTotp(String(formData.get("code") ?? ""), decrypt(user.totpSecretEnc))) {
    redirect("/setup-2fa?error=1");
  }
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await audit({ userId: user.id, action: "ENABLE_2FA", entity: "User", entityId: user.id });
  // Sign in again so the session carries the new 2FA status.
  await signOut({ redirectTo: "/login?enabled=1" });
}

export default async function Setup2fa({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let user = await requireUser();
  if (user.totpEnabled) redirect("/");
  if (!user.totpSecretEnc) {
    user = await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: encrypt(newTotpSecret()) } });
  }
  const secret = decrypt(user.totpSecretEnc!);
  const qr = await QRCode.toDataURL(totpUri(user.email, secret));

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={enable} className="card w-full max-w-md space-y-4">
        <h1>I-on ang 2-factor login</h1>
        <p className="text-sm text-slate-700">
          Para protektado ang patient records, kailangan ng 6-digit code tuwing mag-login. Gamitin ang Google
          Authenticator o Microsoft Authenticator sa phone ninyo.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Buksan ang authenticator app at piliin ang “Add account / Scan QR code”.</li>
          <li>I-scan ang QR code sa ibaba.</li>
          <li>Ilagay ang 6-digit code na lalabas.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="2FA QR code" className="mx-auto h-48 w-48" />
        <p className="break-all text-center text-xs text-slate-500">Hindi ma-scan? Manual key: {secret}</p>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Mali ang code. Subukan ulit.</p>}
        <input className="input text-center tracking-widest" name="code" inputMode="numeric" placeholder="123456" required />
        <button className="btn w-full">I-verify at i-on</button>
      </form>
    </main>
  );
}
