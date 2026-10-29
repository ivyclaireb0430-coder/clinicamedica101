import { renderScript } from "../scripts";
import type { OutMessage, QuickReply } from "./meta";

// Messenger conversation logic. Pure apart from the injected deps, so it can be unit-tested.
// Rules: never diagnose, recommend treatment or promise results. Anything medical goes to the doctor.

export type FlowState =
  | { step: "IDLE" }
  | { step: "CONSENT"; rescheduleId?: string }
  | { step: "PICK_TYPE"; rescheduleId?: string }
  | { step: "PICK_SLOT"; typeId: string; page: number; rescheduleId?: string }
  | { step: "ASK_NAME"; typeId: string; startAt: string; rescheduleId?: string }
  | { step: "ASK_MOBILE"; typeId: string; startAt: string; rescheduleId?: string };

export type Incoming = { text?: string; payload?: string };

export type Slot = { startAt: Date; label: string };

export type BotContext = {
  firstName: string;
  hasFullName: boolean;
  privacyConsent: boolean;
  mobile: string | null;
  isNewConversation: boolean;
  /** Next BOOKED/CONFIRMED appointment, if any. */
  upcoming: { id: string; status: string; dateLabel: string; timeLabel: string } | null;
  /** Doctor was already notified recently, so don't repeat the hand-off reply. */
  recentlyHandedOff: boolean;
  scripts: Record<string, string>;
  consultationTypes: { id: string; name: string; feeLabel: string }[];
  privacyUrl: string;
};

export type BotDeps = {
  slots(typeId: string, page: number): Promise<{ slots: Slot[]; hasMore: boolean }>;
  book(input: { typeId: string; startAt: Date; rescheduleId?: string }): Promise<
    { ok: true; dateLabel: string; timeLabel: string } | { ok: false }
  >;
  confirmAppointment(id: string): Promise<void>;
  recordConsent(): Promise<void>;
  saveName(full: string): Promise<void>;
  saveMobile(mobile: string): Promise<void>;
  handoff(): Promise<void>;
  setStage(stage: "REPLIED" | "FEE_EXPLAINED"): Promise<void>;
};

export type BotResult = { replies: OutMessage[]; state: FlowState };

export const MENU: QuickReply[] = [
  { title: "Paano ang consult?", payload: "MENU_HOW" },
  { title: "Magkano ang fee?", payload: "MENU_FEE" },
  { title: "Available schedule", payload: "MENU_SCHED" },
  { title: "Location", payload: "MENU_LOCATION" },
  { title: "Mag-book", payload: "MENU_BOOK" },
  { title: "Kausapin ang doktor", payload: "MENU_DOCTOR" },
];

const IDLE: FlowState = { step: "IDLE" };

const INTENTS: [RegExp, string][] = [
  [/\b(resched|reschedule|ibang (araw|oras)|palitan|move)\b/i, "RESCHED"],
  [/\b(magkano|presyo|price|how much|fee|bayad|rate|cost)\b/i, "MENU_FEE"],
  [/\b(saan|where|location|address|lokasyon|parking|direksyon)\b/i, "MENU_LOCATION"],
  [/\b(book|booking|appointment|appt|magpa-?schedule|pa-?book|pa-?sched)\b/i, "MENU_BOOK"],
  [/\b(schedule|sched|available|bakante|open|clinic hours|oras)\b/i, "MENU_SCHED"],
  [/\b(paano|how does|process|proseso|ano ang mangyayari)\b/i, "MENU_HOW"],
  [/\b(doktor|doctor|doc|dra?\.?)\b/i, "MENU_DOCTOR"],
  [/^(hi|hello|hey|good (morning|afternoon|evening)|magandang (umaga|hapon|gabi)|kumusta|musta|start|get started)\b/i, "GREETING"],
];

export function detectIntent(text: string): string | null {
  for (const [re, intent] of INTENTS) if (re.test(text.trim())) return intent;
  return null;
}

export function isConfirmation(text: string): boolean {
  return /^(ok|okay|oki|oo|opo|yes|yup|confirm(ed)?|sige|g|game|noted)\b/i.test(text.trim());
}

/** Normalize a Philippine mobile number to 09XXXXXXXXX, or null if invalid. */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const m = digits.match(/^(?:\+?63|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : null;
}

export function parseState(json: string | null | undefined): FlowState {
  if (!json) return IDLE;
  try {
    const s = JSON.parse(json) as FlowState;
    return s && typeof s.step === "string" ? s : IDLE;
  } catch {
    return IDLE;
  }
}

function script(ctx: BotContext, key: string, extra: Record<string, string> = {}) {
  return renderScript(ctx.scripts[key] ?? "", { first_name: ctx.firstName, ...extra }).replace("[link]", ctx.privacyUrl);
}

const BACK_TO_MENU: QuickReply[] = [{ title: "Bumalik sa menu", payload: "MENU" }];

export async function handleMessage(ctx: BotContext, state: FlowState, input: Incoming, deps: BotDeps): Promise<BotResult> {
  const text = input.text?.trim() ?? "";
  const payload = input.payload ?? "";

  if (payload === "CANCEL_FLOW" || payload === "MENU") {
    return { replies: [{ text: "Sige po. Ano pa po ang maitutulong namin?", quickReplies: MENU }], state: IDLE };
  }

  // Booking flow steps take precedence over free text.
  if (state.step !== "IDLE") {
    const r = await continueFlow(ctx, state, input, deps);
    if (r) return r;
  }

  // Reply to a reminder.
  if (!payload && ctx.upcoming && ctx.upcoming.status === "BOOKED" && isConfirmation(text)) {
    await deps.confirmAppointment(ctx.upcoming.id);
    return {
      replies: [{ text: `Salamat po, ${ctx.firstName}! Confirmed na ang inyong appointment sa ${ctx.upcoming.dateLabel}, ${ctx.upcoming.timeLabel}. Kita-kits po!` }],
      state: IDLE,
    };
  }

  let intent = payload || (text ? detectIntent(text) : null);
  if (intent === "RESCHED" && !ctx.upcoming) intent = "MENU_BOOK";

  if (ctx.isNewConversation && (!intent || intent === "GREETING")) {
    // First contact: greet, privacy notice, menu. Free text is also flagged for the doctor if it isn't a simple greeting.
    if (text && !intent) await deps.handoff();
    await deps.setStage("REPLIED");
    return { replies: [{ text: script(ctx, "first_reply"), quickReplies: MENU }], state: IDLE };
  }

  switch (intent) {
    case "GREETING":
      await deps.setStage("REPLIED");
      return { replies: [{ text: `Hi ${ctx.firstName}! Ano po ang maitutulong namin?`, quickReplies: MENU }], state: IDLE };
    case "MENU_HOW":
      await deps.setStage("REPLIED");
      return {
        replies: [{ text: script(ctx, "approach") }, { text: script(ctx, "first_consult"), quickReplies: MENU }],
        state: IDLE,
      };
    case "MENU_FEE":
      await deps.setStage("FEE_EXPLAINED");
      return { replies: [{ text: script(ctx, "fee"), quickReplies: MENU }], state: IDLE };
    case "MENU_LOCATION":
      await deps.setStage("REPLIED");
      return { replies: [{ text: script(ctx, "location"), quickReplies: MENU }], state: IDLE };
    case "MENU_SCHED":
    case "MENU_BOOK":
      await deps.setStage(intent === "MENU_SCHED" ? "FEE_EXPLAINED" : "REPLIED");
      return startBooking(ctx, deps);
    case "RESCHED":
      return startBooking(ctx, deps, ctx.upcoming!.id);
    case "CONSENT_YES":
    case "CONSENT_NO":
      return continueFlow(ctx, { step: "CONSENT" }, input, deps) as Promise<BotResult>;
    case "MENU_DOCTOR":
      await deps.handoff();
      return {
        replies: [{ text: `Sige po, ${ctx.firstName}. Naipasa ko na po sa doktor at siya mismo ang sasagot dito sa lalong madaling panahon.` }],
        state: IDLE,
      };
    default:
      // Unknown free text: could be a symptom or complaint. Never answer medically; hand off to the doctor.
      await deps.handoff();
      if (ctx.recentlyHandedOff) return { replies: [], state: IDLE };
      return { replies: [{ text: script(ctx, "doctor_handoff"), quickReplies: MENU }], state: IDLE };
  }
}

async function startBooking(ctx: BotContext, deps: BotDeps, rescheduleId?: string): Promise<BotResult> {
  if (!ctx.privacyConsent) {
    return {
      replies: [
        {
          text: `Bago po tayo mag-book, paki-basa po ang aming privacy notice: ${ctx.privacyUrl}\nKukunin po namin ang inyong pangalan at mobile number para sa appointment. Sang-ayon po ba kayo?`,
          quickReplies: [
            { title: "Oo, sang-ayon ako", payload: "CONSENT_YES" },
            { title: "Hindi muna", payload: "CONSENT_NO" },
          ],
        },
      ],
      state: { step: "CONSENT", rescheduleId },
    };
  }
  return askType(ctx, deps, rescheduleId);
}

async function askType(ctx: BotContext, deps: BotDeps, rescheduleId?: string): Promise<BotResult> {
  if (ctx.consultationTypes.length === 1) return askSlot(ctx, deps, ctx.consultationTypes[0].id, 0, rescheduleId);
  return {
    replies: [
      {
        text: `Anong klase po ng consultation?\n${ctx.consultationTypes.map((t) => `• ${t.name} (${t.feeLabel})`).join("\n")}`,
        quickReplies: [...ctx.consultationTypes.map((t) => ({ title: t.name, payload: `TYPE:${t.id}` })), ...BACK_TO_MENU],
      },
    ],
    state: { step: "PICK_TYPE", rescheduleId },
  };
}

async function askSlot(ctx: BotContext, deps: BotDeps, typeId: string, page: number, rescheduleId?: string): Promise<BotResult> {
  const { slots, hasMore } = await deps.slots(typeId, page);
  if (slots.length === 0) {
    await deps.handoff();
    return {
      replies: [{ text: "Pasensya na po, wala pong bakanteng oras sa mga susunod na araw. Ipapaalam ko po sa doktor para matulungan kayo.", quickReplies: MENU }],
      state: IDLE,
    };
  }
  return {
    replies: [
      {
        text: "Pumili po ng oras na pinaka-convenient sa inyo:",
        quickReplies: [
          ...slots.map((s) => ({ title: s.label, payload: `SLOT:${s.startAt.toISOString()}` })),
          ...(hasMore ? [{ title: "Iba pang oras", payload: `MORE:${page + 1}` }] : []),
          { title: "Kanselahin", payload: "CANCEL_FLOW" },
        ],
      },
    ],
    state: { step: "PICK_SLOT", typeId, page, rescheduleId },
  };
}

async function finishBooking(
  ctx: BotContext,
  deps: BotDeps,
  s: { typeId: string; startAt: string; rescheduleId?: string },
): Promise<BotResult> {
  const result = await deps.book({ typeId: s.typeId, startAt: new Date(s.startAt), rescheduleId: s.rescheduleId });
  if (!result.ok) {
    const again = await askSlot(ctx, deps, s.typeId, 0, s.rescheduleId);
    return { replies: [{ text: "Pasensya na po, may nauna nang nag-book sa oras na iyon." }, ...again.replies], state: again.state };
  }
  return {
    replies: [{ text: script(ctx, "booking_confirm", { date: result.dateLabel, time: result.timeLabel }) }],
    state: IDLE,
  };
}

async function continueFlow(ctx: BotContext, state: FlowState, input: Incoming, deps: BotDeps): Promise<BotResult | null> {
  const text = input.text?.trim() ?? "";
  const payload = input.payload ?? "";

  switch (state.step) {
    case "CONSENT":
      if (payload === "CONSENT_YES" || (!payload && isConfirmation(text))) {
        await deps.recordConsent();
        return askType({ ...ctx, privacyConsent: true }, deps, state.rescheduleId);
      }
      if (payload === "CONSENT_NO") {
        return {
          replies: [{ text: "Okay lang po. Kung may tanong pa kayo, nandito lang po kami.", quickReplies: MENU }],
          state: IDLE,
        };
      }
      return null;
    case "PICK_TYPE":
      if (payload.startsWith("TYPE:")) return askSlot(ctx, deps, payload.slice(5), 0, state.rescheduleId);
      return null;
    case "PICK_SLOT":
      if (payload.startsWith("MORE:")) return askSlot(ctx, deps, state.typeId, Number(payload.slice(5)) || 0, state.rescheduleId);
      if (payload.startsWith("SLOT:")) {
        const next = { typeId: state.typeId, startAt: payload.slice(5), rescheduleId: state.rescheduleId };
        if (state.rescheduleId || (ctx.hasFullName && ctx.mobile)) return finishBooking(ctx, deps, next);
        if (!ctx.hasFullName) {
          return { replies: [{ text: "Ano po ang inyong buong pangalan (first at last name)?" }], state: { step: "ASK_NAME", ...next } };
        }
        return { replies: [{ text: "Ano po ang inyong mobile number? (hal. 0917 123 4567)" }], state: { step: "ASK_MOBILE", ...next } };
      }
      return null;
    case "ASK_NAME":
      if (text && !payload) {
        if (text.length < 2 || text.length > 80) return { replies: [{ text: "Paki-type po ang inyong buong pangalan." }], state };
        await deps.saveName(text);
        const first = text.split(/\s+/)[0];
        if (ctx.mobile) return finishBooking({ ...ctx, firstName: first }, deps, state);
        return {
          replies: [{ text: `Salamat po, ${first}! Ano po ang inyong mobile number? (hal. 0917 123 4567)` }],
          state: { ...state, step: "ASK_MOBILE" },
        };
      }
      return null;
    case "ASK_MOBILE":
      if (text && !payload) {
        const mobile = normalizePhMobile(text);
        if (!mobile) {
          return { replies: [{ text: "Mukhang hindi tama ang number. Paki-type po ulit (hal. 0917 123 4567)." }], state };
        }
        await deps.saveMobile(mobile);
        return finishBooking(ctx, deps, state);
      }
      return null;
    default:
      return null;
  }
}
