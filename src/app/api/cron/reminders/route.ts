import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";

// Call every 15 minutes: curl -H "Authorization: Bearer $CRON_SECRET" {APP_URL}/api/cron/reminders
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, result: await runReminders() });
}
