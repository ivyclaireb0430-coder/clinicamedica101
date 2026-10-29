export const ROLES = ["OWNER", "DOCTOR", "FRONT_DESK"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  DOCTOR: "Doctor",
  FRONT_DESK: "Front desk",
};

export type Permission =
  | "leads:read"
  | "leads:write"
  | "lead_concern:read" // the short health concern on a lead
  | "clinical:read"
  | "clinical:write"
  | "booking:read"
  | "booking:write"
  | "scripts:write"
  | "settings:manage"
  | "users:manage"
  | "audit:read"
  | "billing:read" // charges, payments, receipts, daily collections
  | "billing:write"
  | "billing:void" // void a payment or charge
  | "reports:read" // receivables aging and monthly performance
  | "feedback:read" // patient feedback comments can mention health details
  | "data:export"; // download lists with personal data as CSV

const MATRIX: Record<Role, Permission[]> = {
  OWNER: [
    "leads:read", "leads:write", "lead_concern:read", "clinical:read", "clinical:write",
    "booking:read", "booking:write", "scripts:write", "settings:manage", "users:manage", "audit:read",
    "billing:read", "billing:write", "billing:void", "reports:read", "feedback:read", "data:export",
  ],
  DOCTOR: [
    "leads:read", "leads:write", "lead_concern:read", "clinical:read", "clinical:write",
    "booking:read", "booking:write", "scripts:write",
    "billing:read", "billing:write", "reports:read", "feedback:read",
  ],
  // Front desk handles scheduling and inquiries but never sees health information.
  FRONT_DESK: ["leads:read", "leads:write", "booking:read", "booking:write", "billing:read", "billing:write"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return MATRIX[role].includes(permission);
}
