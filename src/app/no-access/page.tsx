import { Suspense } from "react";
import { signOut } from "@/lib/auth/actions";
import { pickMembership, requireSignedIn, activeCompanyId } from "@/lib/auth/session";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NoAccessPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Checking access…</p>}>
      <NoAccessScreen />
    </Suspense>
  );
}

async function NoAccessScreen() {
  const context = await requireSignedIn();
  const membership = pickMembership(context.memberships ?? [], await activeCompanyId());
  let title = "No company yet";
  let lede =
    "This login is not on a FloorTrack company. Ask a manager for an invite, or open the join link they gave you.";
  if (membership?.company_status === "suspended") {
    title = "Company suspended";
    lede = `${membership.company_name} is suspended. A platform owner has to turn it back on before anyone can work the floor.`;
  } else if (membership?.status === "disabled") {
    title = "Access disabled";
    lede = `Your membership at ${membership.company_name} is disabled. A manager can turn it back on.`;
  } else if (context.is_platform_admin) {
    title = "Owner desk";
    lede = "You are not inside a company right now. Open the owner dashboard to create one.";
  }

  return (
    <AuthCard title={title} lede={lede}>
      <div className="flex flex-wrap gap-3">
        {context.is_platform_admin ? (
          <Button asChild>
            <Link href="/owner">Open owner dashboard</Link>
          </Button>
        ) : null}
        <form action={signOut}>
          <Button type="submit" variant="quiet">
            Sign out
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}
