import { createHmac, timingSafeEqual } from "node:crypto";

// Signed link from a Messenger chat to the booking form (/book/<token>), so a patient picks a date on a calendar
// and fills in name, mobile and email in one go instead of answering one question at a time (owner, Nov 23 2026).
// The token names the conversation and expires; it carries no personal details.

export const BOOKING_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string | null {
  return process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(`messenger-booking:${payload}`).digest("base64url").slice(0, 32);
}

export function bookingToken(conversationId: string, now = Date.now(), key = secret()): string | null {
  if (!key || !/^[a-z0-9]+$/i.test(conversationId)) return null;
  const payload = `${conversationId}.${Math.floor((now + BOOKING_LINK_TTL_MS) / 1000).toString(36)}`;
  return `${payload}.${sign(payload, key)}`;
}

/** The conversation id in a valid, unexpired token, else null. */
export function verifyBookingToken(token: string, now = Date.now(), key = secret()): string | null {
  if (!key || token.length > 120) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = sign(`${id}.${exp}`, key);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const expiresAt = parseInt(exp, 36) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;
  return id;
}

export function bookingUrl(conversationId: string): string | null {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  const token = bookingToken(conversationId);
  return base && token ? `${base}/book/${token}` : null;
}
