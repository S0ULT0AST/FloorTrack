import { LaterPhase } from "@/components/shell/placeholder";
import { requireWorkspace, activeStoreId } from "@/lib/auth/session";

export default async function MapPage() {
  const { membership } = await requireWorkspace();
  const storeId = await activeStoreId();
  const store =
    membership.stores.find((item) => item.id === storeId) ??
    membership.stores.find((item) => item.id === membership.primary_store_id) ??
    membership.stores[0];

  return (
    <LaterPhase
      kicker={store ? `${store.name} · ${store.type}` : membership.company_name}
      title="Floor map"
      body="The grid, pan and zoom, and the layout editor arrive in a later phase. Sites are already real: use the switcher to move between warehouse and retail locations in this company. Everyone in the company can see every site."
    />
  );
}
