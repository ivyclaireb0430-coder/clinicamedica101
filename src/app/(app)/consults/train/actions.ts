"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { redact } from "@/lib/messenger/ai";
import { aiApiKey } from "@/lib/messenger/ai-context";
import { decideConsultReply, medicineProblems, type ConsultLessonText } from "@/lib/consult/ai";
import { docTrainerTurn } from "@/lib/consult/trainer";
import { consultDoctorName, consultProfile, loadConsultLessons, takeConsultQuota } from "@/lib/consult/store";

const line = z.object({ from: z.enum(["doctor", "ai"]), text: z.string().max(8000) });

export type DocTurnResult = {
  error?: string;
  reply?: string;
  lessons?: ConsultLessonText[];
  preview?: { patientMessage: string; reply?: string; note?: string };
};

export async function trainDocAiTurn(input: { history: unknown }): Promise<DocTurnResult> {
  await requirePermission("consult:train");
  const history = z.array(line).min(1).max(60).safeParse(input.history);
  if (!history.success || history.data.at(-1)?.from !== "doctor") return { error: "Mag-type ng message." };
  const apiKey = await aiApiKey();
  if (!apiKey) return { error: "Wala pang AI API key. Ilagay muna ito sa Messenger settings." };
  if (!(await takeConsultQuota())) return { error: "Naabot na ang daily AI limit ng online konsulta (Settings → Online konsulta)." };
  const [doctorName, lessons] = await Promise.all([consultDoctorName(), loadConsultLessons()]);
  const known = lessons.map((l) => ({ kind: l.kind, text: l.text }));
  const turn = await docTrainerTurn({ doctorName, lessons: known, history: history.data, apiKey });
  if (!turn) return { error: "Hindi sumagot ang AI (error o timeout). Subukan ulit." };
  let preview: DocTurnResult["preview"];
  if (turn.tryMessage) {
    // The real patient-chat path, with all its safety checks, on a test patient.
    const profile = await consultProfile({ firstName: "Juan", birthDate: null, sex: null });
    const d = await decideConsultReply({ text: turn.tryMessage, profile, history: [{ from: "patient", text: turn.tryMessage }], apiKey });
    preview =
      d.kind === "emergency"
        ? { patientMessage: turn.tryMessage, reply: d.reply, note: "Emergency: hihinto ang AI, ito ang makikita ng pasyente, at ie-email si Doc." }
        : d.kind === "failed"
          ? { patientMessage: turn.tryMessage, reply: d.reply, note: "Hindi sumagot ang AI; ito ang safe na sagot na makikita ng pasyente." }
          : { patientMessage: turn.tryMessage, reply: d.reply, note: d.filtered ? "Na-block ng safety filter (may gamot, dose o diagnosis), kaya ito ang safe na sagot." : undefined };
  }
  return { reply: turn.reply, lessons: turn.lessons, preview };
}

export async function saveDocLesson(input: { kind: string; text: string }) {
  const user = await requirePermission("consult:train");
  const parsed = z.object({ kind: z.enum(["STYLE", "QUESTION", "ADVICE", "FACT"]), text: z.string().trim().min(3).max(400) }).safeParse(input);
  if (!parsed.success) return { error: "Hindi ma-save ang aral." };
  if (medicineProblems(parsed.data.text).length) return { error: "Hindi puwedeng ituro sa AI ang gamot o dose. Si Doc lang ang nagre-reseta." };
  const lesson = await db.consultLesson.create({ data: { kind: parsed.data.kind, text: redact(parsed.data.text) } });
  await audit({ userId: user.id, action: "CREATE", entity: "ConsultLesson", entityId: lesson.id });
  revalidatePath("/consults/train");
  return { id: lesson.id };
}

export async function deleteDocLesson(formData: FormData) {
  const user = await requirePermission("consult:train");
  const id = z.string().min(1).parse(formData.get("id"));
  await db.consultLesson.deleteMany({ where: { id } });
  await audit({ userId: user.id, action: "DELETE", entity: "ConsultLesson", entityId: id });
  revalidatePath("/consults/train");
}
