"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";

const schema = z.object({ title: z.string().trim().min(1).max(100), body: z.string().trim().min(1).max(2000) });

export async function saveScript(id: string, formData: FormData) {
  const user = await requirePermission("scripts:write");
  const data = schema.parse({ title: formData.get("title"), body: formData.get("body") });
  await db.script.update({ where: { id }, data });
  await audit({ userId: user.id, action: "UPDATE", entity: "Script", entityId: id });
  revalidatePath("/scripts");
}
