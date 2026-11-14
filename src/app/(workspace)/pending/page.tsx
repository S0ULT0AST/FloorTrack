import { LaterPhase } from "@/components/shell/placeholder";
import { requireWorkspace } from "@/lib/auth/session";

export default async function PendingPage() {
  const { membership } = await requireWorkspace();
  return (
    <LaterPhase
      kicker={membership.company_name}
      title="Waiting for approval"
      body={`${membership.username} is on the guest list at ${membership.company_name}. A manager will assign a role. Until then you can open the floor map and inventory, and you cannot change anything.`}
    />
  );
}
