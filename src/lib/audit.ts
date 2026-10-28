import { db } from "./db";

/** Record who did what. `detail` must never contain health information. */
export async function audit(entry: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string;
}) {
  await db.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      detail: entry.detail,
    },
  });
}
