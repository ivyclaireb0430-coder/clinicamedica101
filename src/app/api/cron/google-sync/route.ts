import { NextResponse } from "next/server";
import { pullFromGoogle } from "@/lib/google";

// Call every 10–15 minutes from the host's cron: curl -H "Authorization: Bearer $CRON_SECRET" {APP_URL}/api/cron/google-sync
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await pullFromGoogle();
  return NextResponse.json({ ok: true, result });
}
