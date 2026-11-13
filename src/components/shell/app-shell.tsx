import Link from "next/link";
import {
  ArrowLeftRight,
  LayoutGrid,
  Map,
  Package,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { setActiveCompany, setActiveStore, signOut } from "@/lib/auth/actions";
import { activeStoreId } from "@/lib/auth/session";
import type { AppContext, MembershipContext } from "@/lib/domain";
import { can, type Permission } from "@/lib/permissions";
import { ThemeSync, ThemeToggle } from "@/components/theme/theme-controls";
import { OfflineBanner } from "@/components/pwa/register-sw";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Map;
  permission?: Permission;
  extra?: boolean;
  badge?: number;
};

export async function AppShell({
  context,
  membership,
  counts,
  children,
}: {
  context: AppContext;
  membership: MembershipContext;
  counts: { transfers: number; repairs: number; sold: number };
  children: React.ReactNode;
}) {
  const perms = membership.permissions;
  const storeId = await activeStoreId();
  const activeStore =
    membership.stores.find((store) => store.id === storeId) ??
    membership.stores.find((store) => store.id === membership.primary_store_id) ??
    membership.stores.find((store) => store.active) ??
    null;

  const items: NavItem[] = [
    { href: "/map", label: "Floor Map", icon: Map, permission: "viewMap" },
    { href: "/inventory", label: "Inventory", icon: Package, permission: "viewInventory" },
    {
      href: "/transfers",
      label: "Transfers",
      icon: ArrowLeftRight,
      permission: "viewTransferHistory",
      badge: counts.transfers,
    },
    {
      href: "/repairs",
      label: "Repairs",
      icon: Wrench,
      extra: membership.role_key !== "guest" && can(perms, "viewInventory"),
      badge: counts.repairs,
    },
    {
      href: "/sold",
      label: "Sold Items",
      icon: LayoutGrid,
      extra: can(perms, "viewSoldList") || can(perms, "viewAudit") || can(perms, "manageUsers"),
      badge: counts.sold,
    },
    { href: "/admin", label: "Admin", icon: Shield, permission: "viewAudit" },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      extra: can(perms, "manageUsers") || can(perms, "manageLocations"),
    },
  ];

  const visible = items.filter((item) => {
    if (item.extra) return true;
    if (item.permission) return can(perms, item.permission);
    return false;
  });

  return (
    <div className="min-h-screen">
      <ThemeSync theme={context.theme} />
      <OfflineBanner />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-raised/95 md:flex">
        <Brand />
        <Nav items={visible} />
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
          <Brand compact />
          {(context.memberships?.length ?? 0) > 1 ? (
            <form action={setActiveCompany} className="flex items-center gap-2">
              <select
                name="company_id"
                defaultValue={membership.company_id}
                className="h-9 rounded-md border border-line bg-sunken px-2 text-sm"
                aria-label="Company"
              >
                {context.memberships?.map((item) => (
                  <option key={item.company_id} value={item.company_id}>
                    {item.company_name}
                  </option>
                ))}
              </select>
              <button className="text-xs font-semibold text-amber" type="submit">
                Switch
              </button>
            </form>
          ) : (
            <p className="hidden text-sm text-muted sm:block">{membership.company_name}</p>
          )}
          {can(perms, "viewLocations") && membership.stores.length > 0 ? (
            <form action={setActiveStore} className="flex min-w-0 items-center gap-2">
              <select
                name="store_id"
                defaultValue={activeStore?.id ?? ""}
                className="h-9 max-w-[14rem] rounded-md border border-line bg-sunken px-2 text-sm"
                aria-label="Site"
              >
                {membership.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} · {store.type}
                  </option>
                ))}
              </select>
              <button className="text-xs font-semibold text-amber" type="submit">
                Open
              </button>
            </form>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {context.is_platform_admin ? (
              <Link href="/owner" className="text-sm font-semibold text-amber">
                Owner
              </Link>
            ) : null}
            <ThemeToggle persist />
            <Link href="/account" className="rounded-full border border-line bg-sunken px-3 py-1 font-mono text-xs">
              {membership.username}
            </Link>
            <form action={signOut}>
              <button className="text-sm text-muted hover:text-text" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        {membership.status === "pending" ? (
          <p className="bg-amber px-4 py-2 text-sm font-semibold text-amber-ink">
            Waiting for a manager to approve your access. You can look around, not change inventory.
          </p>
        ) : null}
        <main className="px-4 py-6 pb-24 md:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-1 overflow-x-auto border-t border-line bg-raised px-2 py-2 md:hidden">
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-w-16 flex-1 flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
          >
            <item.icon size={16} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/map" className={compact ? "font-bold tracking-tight md:hidden" : "px-4 py-5 text-lg font-bold tracking-tight"}>
      Floor<span className="text-amber">Track</span>
    </Link>
  );
}

function Nav({ items }: { items: NavItem[] }) {
  return (
    <nav className="grid gap-1 px-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-sunken hover:text-text"
        >
          <item.icon size={16} />
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-amber px-2 py-0.5 font-mono text-[10px] text-amber-ink">{item.badge}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
