import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/messenger/meta";
import { handleEvent, type MessagingEvent } from "@/lib/messenger/handler";

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
    return new Response("Invalid signature", { status: 401 });
  }
  let body: { object?: string; entry?: { messaging?: MessagingEvent[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (body.object !== "page") return NextResponse.json({ ok: true });

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      try {
        await handleEvent(event);
      } catch (err) {
        // Never log message content (may contain health details).
        console.error("Messenger event failed:", (err as Error).message);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
