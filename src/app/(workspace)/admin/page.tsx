import { LaterPhase } from "@/components/shell/placeholder";

export default function AdminPage() {
  return (
    <LaterPhase
      kicker="Audit and roles"
      title="Admin"
      body="Custom roles, statuses, map colors, and the audit log viewer come later. Role defaults are already seeded, and every membership change writes an audit row. The notification master switch is off and this screen cannot turn it on."
    />
  );
}
