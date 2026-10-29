"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { HUMAN_AGENT_WINDOW_MS, sendText, withinWindow } from "@/lib/messenger/meta";
import { storeOutgoing } from "@/lib/messenger/handler";

export async function sendReply(conversationId: string, formData: FormData) {
  const user = await requirePermission("lead_concern:read");
  const text = z.string().trim().min(1).max(1999).parse(formData.get("text"));
  const convo = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });

  // Inside 24h: normal reply. Up to 7 days: HUMAN_AGENT tag (manual replies only). After that Meta blocks it.
  const mode = withinWindow(convo.lastUserMessageAt) ? "RESPONSE" : withinWindow(convo.lastUserMessageAt, new Date(), HUMAN_AGENT_WINDOW_MS) ? "HUMAN_AGENT" : null;
  if (!mode) redirect(`/inbox/${conversationId}?error=window`);

  const result = await sendText(convo.psid, { text }, mode);
  await storeOutgoing(conversationId, text, "DOCTOR", result);
  // A personal reply = human takeover: pause the bot for this conversation.
  await db.conversation.update({
    where: { id: conversationId },
    data: { automationPaused: true, pausedAt: new Date(), needsDoctor: false, flowState: null },
  });
  await db.lead.update({ where: { id: convo.leadId }, data: { lastContactAt: new Date() } });
  await audit({ userId: user.id, action: "SEND", entity: "Conversation", entityId: conversationId });
  if (result.error) redirect(`/inbox/${conversationId}?error=send`);
  revalidatePath(`/inbox/${conversationId}`);
}

export async function setPaused(conversationId: string, paused: boolean) {
  const user = await requirePermission("lead_concern:read");
  await db.conversation.update({
    where: { id: conversationId },
    data: { automationPaused: paused, pausedAt: paused ? new Date() : null, flowState: null },
  });
  await audit({ userId: user.id, action: "UPDATE", entity: "Conversation", entityId: conversationId, detail: paused ? "paused" : "resumed" });
  revalidatePath(`/inbox/${conversationId}`);
}

export async function markHandled(conversationId: string) {
  const user = await requirePermission("lead_concern:read");
  await db.conversation.update({ where: { id: conversationId }, data: { needsDoctor: false } });
  await audit({ userId: user.id, action: "UPDATE", entity: "Conversation", entityId: conversationId, detail: "handled" });
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
}
