import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformOwnerEmails } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AppContext, MembershipContext } from "@/lib/domain";

export async function readContext(): Promise<AppContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_context");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? { signed_in: false }) as AppContext;
}

export async function ensurePlatformOwner() {
  const allowlist = platformOwnerEmails();
  if (allowlist.length === 0) return;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return;

  const email = String(data.claims.email ?? "").toLowerCase();
  const userId = String(data.claims.sub ?? "");
  if (!userId || !allowlist.includes(email)) return;

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("platform_admins")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function activeCompanyId() {
  const jar = await cookies();
  return jar.get("ft_company")?.value ?? null;
}

export async function activeStoreId() {
  const jar = await cookies();
  return jar.get("ft_store")?.value ?? null;
}

export function pickMembership(
  memberships: MembershipContext[],
  preferredId: string | null,
) {
  return (
    memberships.find((membership) => membership.company_id === preferredId) ??
    memberships.find((membership) => membership.status === "active") ??
    memberships[0] ??
    null
  );
}

export async function landingPath(context: AppContext) {
  if (!context.signed_in) return "/login";
  if (context.is_platform_admin && (context.memberships?.length ?? 0) === 0) {
    return "/owner";
  }
  const membership = pickMembership(
    context.memberships ?? [],
    await activeCompanyId(),
  );
  if (!membership) {
    return context.is_platform_admin ? "/owner" : "/no-access";
  }
  if (membership.company_status === "suspended" || membership.status === "disabled") {
    return "/no-access";
  }
  if (membership.status === "pending") return "/pending";
  return "/map";
}

export async function requireSignedIn() {
  await ensurePlatformOwner();
  const context = await readContext();
  if (!context.signed_in) redirect("/login");
  return context;
}

export async function requireWorkspace() {
  const context = await requireSignedIn();
  const membership = pickMembership(
    context.memberships ?? [],
    await activeCompanyId(),
  );
  if (!membership) {
    redirect(context.is_platform_admin ? "/owner" : "/no-access");
  }
  if (membership.company_status === "suspended" || membership.status === "disabled") {
    redirect("/no-access");
  }
  return { context, membership };
}
