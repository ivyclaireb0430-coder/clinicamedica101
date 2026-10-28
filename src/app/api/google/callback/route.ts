import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectGoogle, pullFromGoogle } from "@/lib/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await auth();
  const jar = await cookies();
  const expected = jar.get("g_state")?.value;
  jar.delete("g_state");
  const code = url.searchParams.get("code");
  if (session?.user?.role !== "OWNER" || !code || !expected || url.searchParams.get("state") !== expected) {
    return NextResponse.redirect(new URL("/settings/google?error=denied", req.url));
  }
  try {
    await connectGoogle(session.user.id, code);
    await pullFromGoogle();
  } catch (err) {
    console.error("Google connect failed:", (err as Error).message);
    return NextResponse.redirect(new URL("/settings/google?error=failed", req.url));
  }
  return NextResponse.redirect(new URL("/settings/google?connected=1", req.url));
}
