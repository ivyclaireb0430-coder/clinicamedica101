import { db } from "../db";
import { unfilledBlanks } from "../scripts";
import { getSetting } from "../settings";
import { formatDate, formatPhp, formatTime } from "../time";
import { decideAiReply, generateAiDecision, type HistoryLine } from "./ai";
import { aiApiKey, loadClinicFacts, loadStyleExamples } from "./ai-context";
import { handleMessage, parseState, type BotDeps, type FlowState, type Incoming } from "./bot";
import { findSlots } from "./handler";
import type { QuickReply } from "./meta";

// Practice chat for staff: runs the real Messenger bot and AI on a pretend conversation.
// Nothing is sent to Facebook and nothing is saved: booking, hand-off and stage changes are only described.

export type SimLine = { from: "patient" | "bot"; text: string; byAi?: boolean; quickReplies?: QuickReply[] };
export type SimSession = {
  lines: SimLine[];
  state: string; // FlowState JSON
  name?: string;
  mobile?: string;
  handedOff?: boolean;
};
export type SimResult = { session: SimSession; notes: string[]; error?: string };

export const EMPTY_SESSION: SimSession = { lines: [], state: JSON.stringify({ step: "IDLE" }) };

export async function simulateTurn(session: SimSession, input: Incoming, opts: { useAi: boolean }): Promise<SimResult> {
  const notes: string[] = [];
  const next: SimSession = { ...session, lines: [...session.lines] };
  const shown = input.text ?? session.lines.at(-1)?.quickReplies?.find((q) => q.payload === input.payload)?.title ?? input.payload ?? "";
  next.lines.push({ from: "patient", text: shown });

  const [scripts, types, health, apiKey] = await Promise.all([
    db.script.findMany({ select: { key: true, body: true } }),
    db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getSetting("aiHealthInquiries"),
    opts.useAi ? aiApiKey() : Promise.resolve(null),
  ]);

  const deps: BotDeps = {
    slots: findSlots,
    async book({ startAt }) {
      notes.push(`Magbu-book sana ng appointment sa ${formatDate(startAt)}, ${formatTime(startAt)} (practice lang, walang na-save).`);
      return { ok: true, dateLabel: formatDate(startAt), timeLabel: formatTime(startAt) };
    },
    async confirmAppointment() {
      notes.push("Iko-confirm sana ang appointment.");
    },
    async recordConsent() {},
    async saveName(full) {
      next.name = full.trim();
      notes.push(`Ise-save sana ang pangalan: ${next.name}`);
    },
    async saveMobile(mobile) {
      next.mobile = mobile;
      notes.push(`Ise-save sana ang mobile: ${mobile}`);
    },
    async handoff() {
      next.handedOff = true;
      notes.push("Aabisuhan sana ang doktor (lalabas sa 'Needs doctor reply').");
    },
    async setStage(stage) {
      notes.push(`Lead stage: ${stage === "FEE_EXPLAINED" ? "Fee explained" : "Replied"}`);
    },
  };
  if (apiKey) {
    const history: HistoryLine[] = next.lines.slice(-8).map((l) => ({ from: l.from === "patient" ? "patient" : "clinic", text: l.text }));
    const firstName = next.name?.split(/\s+/)[0];
    deps.ai = async (text) => {
      const [facts, examples] = await Promise.all([loadClinicFacts(), loadStyleExamples()]);
      const decision = await decideAiReply({ text, facts, history, firstName, examples, allowHealth: health === "1" }, (args) => generateAiDecision({ ...args, apiKey }));
      if (!decision) notes.push("Hindi sumagot ang AI (error, timeout o tinanggihan ang sagot), kaya ang script ang ginamit.");
      else if (decision.notifyDoctor) notes.push("Health inquiry: aabisuhan din sana ang doktor.");
      return decision;
    };
  }

  const firstName = next.name?.split(/\s+/)[0];
  const state: FlowState = parseState(session.state);
  const result = await handleMessage(
    {
      firstName: firstName ?? "po",
      hasFullName: Boolean(next.name && next.name.trim().includes(" ")),
      privacyConsent: false,
      mobile: next.mobile ?? null,
      isNewConversation: session.lines.length === 0,
      upcoming: null,
      recentlyHandedOff: Boolean(session.handedOff),
      scripts: Object.fromEntries(scripts.map((s) => [s.key, s.body])),
      consultationTypes: types.map((t) => ({ id: t.id, name: t.name, feeLabel: formatPhp(t.feePhp) })),
      privacyUrl: `${process.env.APP_URL ?? ""}/privacy`,
    },
    state,
    input,
    deps,
  );
  for (const r of result.replies) {
    next.lines.push({ from: "bot", text: r.text, byAi: r.byAi, quickReplies: r.quickReplies });
    const blanks = unfilledBlanks(r.text);
    if (blanks.length) notes.push(`May hindi pa napupunang bahagi sa script: ${blanks.join(", ")}. Ayusin ito sa Scripts bago i-live.`);
  }
  if (result.replies.length === 0) notes.push("Walang sagot ang bot dito; hihintayin ang staff.");
  next.state = JSON.stringify(result.state);
  return { session: next, notes };
}
