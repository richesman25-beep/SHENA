import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { sessionClient } from "../supabase/server";
import {
  hasAdminRole,
  parseCapabilities,
  type AdminCapabilities,
} from "./policy";
export const adminContext = cache(async () => {
  try {
    const client = await sessionClient();
    if (!client) return { status: "unconfigured" as const };
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { status: "anonymous" as const };
    if (!hasAdminRole(data.user)) return { status: "forbidden" as const };
    const result = await client.rpc("shena_admin_status");
    return {
      status: "admin" as const,
      client,
      userId: data.user.id,
      capabilities: result.error ? null : parseCapabilities(result.data),
    };
  } catch {
    return { status: "unavailable" as const };
  }
});
export async function requireAdmin(
  capability?: keyof Omit<AdminCapabilities, "version">,
) {
  const context = await adminContext();
  if (context.status !== "admin")
    throw new Error("Accès administrateur refusé.");
  if (capability && !context.capabilities?.[capability])
    throw new Error(
      "Les politiques ou structures nécessaires ne sont pas encore installées et vérifiées.",
    );
  return context;
}
export async function adminPage() {
  const context = await adminContext();
  if (context.status === "anonymous") redirect("/admin/connexion");
  return context;
}

export async function adminView() {
  const context = await adminContext();
  return context.status === "admin" ? context : null;
}
