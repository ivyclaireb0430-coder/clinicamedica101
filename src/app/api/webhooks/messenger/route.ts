import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/messenger/meta";
import { handleEvent, type MessagingEvent } from "@/lib/messenger/handler";
import { setSetting } from "@/lib/settings";
import { handleFeedChange, type FeedChange } from "@/lib/messenger/comments";

async function noteDelivery(key: "messengerLastOkAt" | "messengerLastBadSigAt") {
  try {
    await setSetting(key, new Date().toISOString());
  } catch {
    // status only; never block the webhook
  }
}

// Meta calls GET once to verify the webhook URL.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = process.env.META_VERIFY_TOKEN;
  if (token && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === token) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    // Usually a wrong App Secret saved in Settings → Messenger.
    console.warn("Messenger webhook: invalid signature (check META_APP_SECRET)");
    await noteDelivery("messengerLastBadSigAt");
    return new Response("Invalid signature", { status: 401 });
  }
  let body: { object?: string; entry?: { messaging?: MessagingEvent[]; standby?: MessagingEvent[]; changes?: FeedChange[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (body.object !== "page") return NextResponse.json({ ok: true });
  await noteDelivery("messengerLastOkAt");

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      try {
        await handleEvent(event);
      } catch (err) {
        // Never log message content (may contain health details).
        console.error("Messenger event failed:", (err as Error).message);
      }
    }
    // Standby: another app or the Page inbox controls this conversation. Record it, never reply.
    for (const event of entry.standby ?? []) {
      try {
        await handleEvent(event, { observeOnly: true });
      } catch (err) {
        console.error("Messenger standby event failed:", (err as Error).message);
      }
    }
    // Comments on Page posts and ads ("feed" webhook field).
    for (const change of entry.changes ?? []) {
      try {
        await handleFeedChange(change);
      } catch (err) {
        console.error("Comment event failed:", (err as Error).message);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
