import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";
import { can, type Permission } from "./roles";

/** Load the signed-in user fresh from the database (so deactivation takes effect immediately). */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/?denied=1");
  return user;
}
