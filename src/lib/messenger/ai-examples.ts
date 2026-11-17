import { createHash } from "node:crypto";
import { redact } from "./ai";

const MEDICINE_ADVICE = /\b(\d+\s?(mg|mcg|ml)|tablets?|capsules?|iinumin|inumin|uminom|gamot na|take \w+ (daily|twice)|reseta|prescri\w*)\b/i;

// Turning past Messenger conversations into anonymized question → reply examples for the AI.
// Pure functions here; database work is in ai-context.ts.

export type ThreadLine = { fromClinic: boolean; text: string; at: Date };
export type ExamplePair = { question: string | null; reply: string; at: Date; hash: string };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove contact details, links and the patient's names. */
export function anonymize(text: string, names: string[]): string {
  let out = redact(text).replace(/https?:\/\/\S+|www\.\S+/gi, "[link]");
  const parts = [...new Set(names.flatMap((n) => n.split(/\s+/)).filter((p) => p.length >= 2))];
  for (const p of parts) out = out.replace(new RegExp(`\\b${escapeRe(p)}\\b`, "gi"), "[name]");
  return out.trim();
}

export function replyHash(reply: string): string {
  return createHash("sha256").update(reply.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
}

/**
 * Pair each clinic reply with the patient message(s) just before it.
 * Skips health-related exchanges, very short or very long replies, and replies in `skip` (bot texts).
 */
export function extractPairs(lines: ThreadLine[], names: string[], skip: Set<string> = new Set()): ExamplePair[] {
  const pairs: ExamplePair[] = [];
  let pending: string[] = [];
  let lastWasClinic = false;
  for (const line of lines) {
    if (!line.fromClinic) {
      if (lastWasClinic) pending = [];
      pending.push(line.text);
      lastWasClinic = false;
      continue;
    }
    lastWasClinic = true;
    const question = pending.slice(-2).join("\n") || null;
    pending = [];
    const raw = line.text.trim();
    if (raw.length < 15 || raw.length > 700) continue;
    // Health questions are fine as examples (how staff invite to book), but never replies that advise on medicines.
    if (MEDICINE_ADVICE.test(raw)) continue;
    const hash = replyHash(raw);
    if (skip.has(hash)) continue;
    pairs.push({ question: question ? anonymize(question, names).slice(0, 400) : null, reply: anonymize(raw, names), at: line.at, hash });
  }
  return pairs;
}
