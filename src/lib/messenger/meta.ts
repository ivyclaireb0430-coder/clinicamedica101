import { createHmac, timingSafeEqual } from "node:crypto";

// Thin client for the Meta Messenger Platform (Send API + webhook signature).
// Docs checked Oct 2026: CONFIRMED_EVENT_UPDATE / ACCOUNT_UPDATE / POST_PURCHASE_UPDATE tags were retired
// on Feb 10, 2026. Outside the 24-hour window, appointment reminders go out as UTILITY template messages
// (needs the page_utility_messaging permission and an approved template), or HUMAN_AGENT for manual replies.

export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type QuickReply = { title: string; payload: string };
export type OutMessage = { text: string; quickReplies?: QuickReply[] };

function graphBase() {
  return `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v25.0"}`;
}

export function messengerConfigured(): boolean {
  return Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN && process.env.META_APP_SECRET);
}

/** Verify X-Hub-Signature-256 so only Meta can call the webhook. */
export function verifySignature(rawBody: string, header: string | null, appSecret = process.env.META_APP_SECRET): boolean {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export function withinWindow(lastUserMessageAt: Date | null | undefined, now = new Date(), windowMs = WINDOW_MS): boolean {
  return Boolean(lastUserMessageAt && now.getTime() - lastUserMessageAt.getTime() < windowMs);
}

/** Quick reply titles are limited to 20 characters and 13 options. */
export function toQuickReplies(replies: QuickReply[]) {
  return replies.slice(0, 13).map((r) => ({ content_type: "text", title: r.title.slice(0, 20), payload: r.payload }));
}

async function post(path: string, body: unknown): Promise<{ message_id?: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${graphBase()}${path}?access_token=${encodeURIComponent(process.env.META_PAGE_ACCESS_TOKEN ?? "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { error: `Network error: ${(err as Error).message}` };
  }
  const json = (await res.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string; code?: number } };
  if (!res.ok) return { error: `Meta ${res.status}: ${json.error?.message ?? "unknown error"}` };
  return { message_id: json.message_id };
}

export async function sendText(
  psid: string,
  msg: OutMessage,
  mode: "RESPONSE" | "HUMAN_AGENT" = "RESPONSE",
): Promise<{ message_id?: string; error?: string }> {
  if (!messengerConfigured()) return { error: "Messenger is not configured" };
  return post(`/${process.env.META_PAGE_ID}/messages`, {
    recipient: { id: psid },
    messaging_type: mode === "HUMAN_AGENT" ? "MESSAGE_TAG" : "RESPONSE",
    ...(mode === "HUMAN_AGENT" ? { tag: "HUMAN_AGENT" } : {}),
    message: { text: msg.text.slice(0, 1999), ...(msg.quickReplies?.length ? { quick_replies: toQuickReplies(msg.quickReplies) } : {}) },
  });
}

/** Approved UTILITY template with positional params, e.g. {{1}} first name, {{2}} date, {{3}} time. */
export async function sendUtilityTemplate(psid: string, templateName: string, language: string, params: string[]) {
  if (!messengerConfigured()) return { error: "Messenger is not configured" };
  return post(`/${process.env.META_PAGE_ID}/messages`, {
    recipient: { id: psid },
    messaging_type: "UTILITY",
    message: {
      template: {
        name: templateName,
        language: { code: language },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
      },
    },
  });
}

export const REMINDER_TEMPLATE_BODY =
  "Hi {{1}}, paalala po ng inyong appointment sa Clinica Medica 101 sa {{2}}, {{3}}. Paki-reply ng OK para i-confirm, o RESCHED kung kailangang palitan. Salamat po.";

/** One-time setup: create the reminder template on the Page. Meta approves utility templates within seconds. */
export async function createReminderTemplate(name: string, language: string) {
  if (!messengerConfigured()) return { error: "Messenger is not configured" };
  const res = await fetch(
    `${graphBase()}/${process.env.META_PAGE_ID}/message_templates?access_token=${encodeURIComponent(process.env.META_PAGE_ACCESS_TOKEN ?? "")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        language,
        category: "UTILITY",
        components: [
          { type: "BODY", text: REMINDER_TEMPLATE_BODY, example: { body_text: [["Ana", "Thu, Nov 5", "10:00 AM"]] } },
        ],
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string } };
  return res.ok ? { id: json.id, status: json.status } : { error: json.error?.message ?? `Meta ${res.status}` };
}

export async function fetchProfile(psid: string): Promise<{ firstName?: string; lastName?: string }> {
  if (!messengerConfigured()) return {};
  try {
    const res = await fetch(
      `${graphBase()}/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(process.env.META_PAGE_ACCESS_TOKEN ?? "")}`,
    );
    if (!res.ok) return {};
    const json = (await res.json()) as { first_name?: string; last_name?: string };
    return { firstName: json.first_name, lastName: json.last_name };
  } catch {
    return {};
  }
}
