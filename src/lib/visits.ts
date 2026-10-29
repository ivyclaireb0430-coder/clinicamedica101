import { db } from "./db";
import { addDays } from "./time";

/** Open follow-ups that a visit on `visitDate` takes care of: anything due up to a week after it. */
export function followUpsSatisfiedBy<T extends { id: string; dueDate: string }>(open: T[], visitDate: string): T[] {
  return open.filter((f) => f.dueDate <= addDays(visitDate, 7));
}

/** Close follow-ups that a visit (attended appointment or logged session) satisfies. */
export async function closeFollowUpsForVisit(patientId: string, visitDate: string) {
  const open = await db.followUp.findMany({ where: { patientId, status: "OPEN" } });
  const done = followUpsSatisfiedBy(open, visitDate);
  if (done.length) {
    await db.followUp.updateMany({ where: { id: { in: done.map((f) => f.id) } }, data: { status: "DONE", completedAt: new Date() } });
  }
  return done.length;
}

