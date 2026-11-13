import Link from "next/link";
import { updateSite } from "@/lib/companies/actions";
import { requireWorkspace } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AddSiteForm, CompanySettingsForm } from "@/components/settings/forms";
import { LaterPhase } from "@/components/shell/placeholder";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const { membership } = await requireWorkspace();
  const manageUsers = can(membership.permissions, "manageUsers");
  const manageLocations = can(membership.permissions, "manageLocations");
  if (!manageUsers && !manageLocations) {
    return (
      <LaterPhase
        kicker="Company"
        title="Settings"
        body="Managing the company is limited to people who can manage users or locations."
      />
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">Company</p>
        <h1 className="mt-1 text-3xl font-bold">{membership.company_name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pick exactly one way people get accounts. You can change it later. Sale and transfer email stays off no matter which you choose.
        </p>
        {manageUsers ? (
          <Link href="/settings/team" className="mt-3 inline-block text-sm font-semibold text-amber">
            People, invites, and approvals
          </Link>
        ) : null}
      </header>
      {manageUsers ? (
        <section className="rounded-xl border border-line bg-raised p-5">
          <CompanySettingsForm
            companyId={membership.company_id}
            name={membership.company_name}
            timezone={membership.timezone}
            mode={membership.account_access_mode}
          />
        </section>
      ) : null}
      {manageLocations ? (
        <section className="rounded-xl border border-line bg-raised p-5">
          <h2 className="font-semibold">Sites</h2>
          <ul className="mt-3 grid gap-3">
            {membership.stores.map((store) => (
              <li key={store.id} className="rounded-md border border-line p-3">
                <form action={updateSite} className="grid gap-3 sm:grid-cols-4">
                  <input type="hidden" name="site_id" value={store.id} />
                  <input className="h-11 rounded-md border border-line bg-sunken px-3" name="name" defaultValue={store.name} />
                  <select className="h-11 rounded-md border border-line bg-sunken px-3" name="site_type" defaultValue={store.type}>
                    <option value="warehouse">Warehouse</option>
                    <option value="retail">Retail</option>
                  </select>
                  <input
                    className="h-11 rounded-md border border-line bg-sunken px-3"
                    name="timezone"
                    defaultValue={store.timezone ?? ""}
                    placeholder="Timezone override"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" value="true" defaultChecked={store.active} />
                      Active
                    </label>
                    <Button type="submit" size="sm" variant="quiet">
                      Save
                    </Button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <AddSiteForm companyId={membership.company_id} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
