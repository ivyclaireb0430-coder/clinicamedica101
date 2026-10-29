import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";
import { runFollowUps } from "@/lib/followup";

// Call every 15 minutes: curl -H "Authorization: Bearer $CRON_SECRET" {APP_URL}/api/cron/reminders
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const reminders = await runReminders();
  const followUps = await runFollowUps();
  return NextResponse.json({ ok: true, result: { ...reminders, ...followUps } });
}
