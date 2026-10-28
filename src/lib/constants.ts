export const LEAD_STAGES = [
  { key: "NEW", label: "New inquiry" },
  { key: "REPLIED", label: "Replied" },
  { key: "FEE_EXPLAINED", label: "Fee/schedule explained" },
  { key: "BOOKED", label: "Booked" },
  { key: "ATTENDED", label: "Attended" },
  { key: "PLAN_ACCEPTED", label: "Treatment plan accepted" },
  { key: "FOLLOW_UP", label: "In follow-up" },
  { key: "LOST", label: "Inactive/Lost" },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["key"];

export const LEAD_STAGE_KEYS = LEAD_STAGES.map((s) => s.key) as LeadStage[];

export function stageLabel(key: string): string {
  return LEAD_STAGES.find((s) => s.key === key)?.label ?? key;
}

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (LEAD_STAGE_KEYS as string[]).includes(value);
}

export const LOST_REASONS = [
  "Price / budget",
  "No reply",
  "Chose another clinic",
  "Only wanted quick fix / medicine",
  "Schedule / distance",
  "Not a fit for services",
  "Other",
];

export const LEAD_SOURCES = [
  { key: "MESSENGER", label: "Messenger" },
  { key: "FB_REEL", label: "FB Reel" },
  { key: "FB_POST", label: "FB post" },
  { key: "RADIO", label: "Radio" },
  { key: "REFERRAL", label: "Referral" },
  { key: "WALK_IN", label: "Walk-in" },
  { key: "WEBSITE", label: "Website" },
  { key: "OTHER", label: "Other" },
] as const;

export function sourceLabel(key: string): string {
  return LEAD_SOURCES.find((s) => s.key === key)?.label ?? key;
}

export const CHANNELS = [
  { key: "FB_REEL", label: "FB Reel" },
  { key: "FB_POST", label: "FB post" },
  { key: "RADIO", label: "Radio" },
  { key: "REFERRAL", label: "Referral" },
  { key: "OTHER", label: "Other" },
] as const;

export const APPOINTMENT_STATUSES = [
  { key: "BOOKED", label: "Booked" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "ATTENDED", label: "Attended" },
  { key: "NO_SHOW", label: "No-show" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "RESCHEDULED", label: "Rescheduled" },
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]["key"];

/** Statuses that occupy a slot on the calendar. */
export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["BOOKED", "CONFIRMED", "ATTENDED", "NO_SHOW"];

export function appointmentStatusLabel(key: string): string {
  return APPOINTMENT_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
