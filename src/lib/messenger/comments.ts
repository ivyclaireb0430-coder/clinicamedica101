import { db } from "../db";
import { audit } from "../audit";
import { getSetting } from "../settings";
import { replyToComment, sendPrivateReply } from "./meta";
import { findOrCreateConversation, storeOutgoing } from "./handler";

// Comment-to-Messenger: when someone comments on a Page post or ad, send them one private Messenger
// message so the bot/AI can take over in the inbox (what Botcake used to do). Needs the Page subscribed
// to the "feed" webhook field and the pages_read_engagement + pages_messaging permissions.

export type FeedChange = {
  field?: string;
  value?: {
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    parent_id?: string;
    message?: string;
    from?: { id?: string; name?: string };
  };
};

const REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** A new comment from someone other than the Page itself. */
export function isNewVisitorComment(change: FeedChange, pageId = process.env.META_PAGE_ID): boolean {
  const v = change.value;
  if (change.field !== "feed" || !v) return false;
  if (v.item !== "comment" || v.verb !== "add" || !v.comment_id) return false;
  if (!v.from?.id || v.from.id === pageId) return false;
  return true;
}

export function fillTemplate(template: string, fullName?: string): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return template
    .replace(/\{name\}/g, first)
    .replace(/Hi\s+!/g, "Hi!")
    .replace(/\s+([!?.,])/g, "$1")
    .trim();
}

export async function handleFeedChange(change: FeedChange): Promise<void> {
  if (!isNewVisitorComment(change)) return;
  const [enabled, automation] = await Promise.all([getSetting("commentRepliesEnabled"), getSetting("automationEnabled")]);
  if (enabled !== "1" || automation !== "1") return;
  const v = change.value!;
  const commentId = v.comment_id!;
  const fromId = v.from!.id!;
  const postId = v.post_id ?? null;

  // Claim the comment first so a webhook retry never sends twice.
  try {
    await db.commentReply.create({ data: { commentId, postId, fromId, status: "SKIPPED" } });
  } catch {
    return;
  }
  // One message per person per post per week, even if they comment several times.
  const recent = await db.commentReply.findFirst({
    where: { fromId, postId, status: "SENT", createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) } },
  });
  if (recent) return;

  const text = fillTemplate(await getSetting("commentPrivateText"), v.from?.name);
  const result = await sendPrivateReply(commentId, text);
  await db.commentReply.update({ where: { commentId }, data: { status: result.error ? "FAILED" : "SENT", error: result.error ?? null } });
  if (result.error) {
    console.error("Comment private reply failed:", result.error);
    return;
  }

  if (result.recipientId) {
    const { conversation } = await findOrCreateConversation(result.recipientId, undefined, v.from?.name);
    await storeOutgoing(conversation.id, text, "BOT", result);
  }
  const publicText = (await getSetting("commentPublicText")).trim();
  if (publicText) {
    const r = await replyToComment(commentId, fillTemplate(publicText, v.from?.name));
    if (r.error) console.error("Public comment reply failed:", r.error);
  }
  await audit({ action: "CREATE", entity: "CommentReply", entityId: commentId, detail: "private Messenger reply to a comment" });
}
