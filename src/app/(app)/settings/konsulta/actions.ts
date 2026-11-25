"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { setSetting } from "@/lib/settings";

export async function saveKonsultaSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const d = z
    .object({
      consultEnabled: z.enum(["0", "1"]),
      consultDoctorName: z.string().trim().max(80),
      consultLicenseNo: z.string().trim().max(40),
      consultPtrNo: z.string().trim().max(40),
      consultS2No: z.string().trim().max(40),
      consultFeeNote: z.string().trim().max(300),
      consultDailyLimit: z.coerce.number().int().min(0).max(5000),
    })
    .parse({ consultEnabled: formData.get("consultEnabled") === "1" ? "1" : "0", ...Object.fromEntries(["consultDoctorName", "consultLicenseNo", "consultPtrNo", "consultS2No", "consultFeeNote", "consultDailyLimit"].map((k) => [k, formData.get(k) ?? ""])) });
  if (d.consultEnabled === "1" && formData.get("doctorConsent") !== "on") {
    redirect("/settings/konsulta?error=consent");
  }
  for (const [k, v] of Object.entries(d)) await setSetting(k as Parameters<typeof setSetting>[0], String(v));
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", entityId: "konsulta", detail: `online konsulta ${d.consultEnabled === "1" ? "ON (doctor consent confirmed)" : "OFF"}` });
  revalidatePath("/settings/konsulta");
  redirect("/settings/konsulta?saved=1");
}
