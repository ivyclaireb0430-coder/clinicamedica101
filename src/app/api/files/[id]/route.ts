import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { decrypt } from "@/lib/crypto";
import { readEncryptedFile } from "@/lib/files";
import { audit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id } }) : null;
  if (!user?.active || !can(user.role, "clinical:read")) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a) return new Response("Not found", { status: 404 });
  const bytes = await readEncryptedFile(a.storageKey);
  await audit({ userId: user.id, action: "VIEW", entity: "Attachment", entityId: id });
  const name = decrypt(a.filenameEnc).replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
