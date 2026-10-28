import { isLeadStage, type LeadStage } from "./constants";

/** Validate a stage change. Moving to LOST requires a reason. */
export function validateStageChange(
  to: string,
  lostReason?: string | null,
): { ok: true; stage: LeadStage } | { ok: false; error: string } {
  if (!isLeadStage(to)) return { ok: false, error: "Unknown stage" };
  if (to === "LOST" && !lostReason?.trim()) return { ok: false, error: "Please choose a reason for Inactive/Lost" };
  return { ok: true, stage: to };
}

/** Days since a date, used for the "needs follow-up" queue. */
export function daysSince(d: Date, now = new Date()): number {
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

/** Leads still before booking with no contact for `days` days need a nudge. */
export function needsFollowUp(lead: { stage: string; lastContactAt: Date }, days: number, now = new Date()): boolean {
  return ["NEW", "REPLIED", "FEE_EXPLAINED"].includes(lead.stage) && daysSince(lead.lastContactAt, now) >= days;
}
