import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") return NextResponse.redirect(new URL("/settings", req.url));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/settings/google?error=config", req.url));
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(googleAuthUrl(state));
}
