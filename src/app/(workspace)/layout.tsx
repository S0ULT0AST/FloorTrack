import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading the floor…</p>}>
      <WorkspaceFrame>{children}</WorkspaceFrame>
    </Suspense>
  );
}

async function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const { context, membership } = await requireWorkspace();
  const supabase = await createClient();
  const companyId = membership.company_id;
  const [transfers, repairs, sold] = await Promise.all([
    supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "active"),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("needs_repair", true)
      .eq("sold", false),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("sold", true),
  ]);

  return (
    <AppShell
      context={context}
      membership={membership}
      counts={{
        transfers: transfers.count ?? 0,
        repairs: repairs.count ?? 0,
        sold: sold.count ?? 0,
      }}
    >
      {children}
    </AppShell>
  );
}
