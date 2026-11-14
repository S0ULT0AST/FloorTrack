import Link from "next/link";
import { setCompanyStatus } from "@/lib/companies/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  timezone: string;
  company_settings: { account_access_mode: string } | { account_access_mode: string }[] | null;
  stores: { id: string; name: string; type: string; active: boolean }[] | null;
};

export default async function OwnerHomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, status, timezone, company_settings(account_access_mode), stores(id, name, type, active)")
    .order("name");

  const companies = (data ?? []) as CompanyRow[];

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">Platform</p>
          <h1 className="mt-1 text-3xl font-bold">Companies</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Each company is walled off. Create one, add its sites, and hand the first manager a link.
          </p>
        </div>
        <Button asChild>
          <Link href="/owner/companies/new">New company</Link>
        </Button>
      </header>
      {error ? <p className="text-sm text-danger">{error.message}</p> : null}
      {companies.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-raised p-6 text-sm text-muted">
          No companies yet. The first one can be Charlie Wilson&apos;s, with a warehouse and a retail site in America/Chicago.
        </p>
      ) : null}
      <ul className="grid gap-4">
        {companies.map((company) => {
          const settings = Array.isArray(company.company_settings)
            ? company.company_settings[0]
            : company.company_settings;
          return (
            <li key={company.id} className="rounded-xl border border-line bg-raised p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{company.name}</h2>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {company.slug} · {company.timezone} · {settings?.account_access_mode ?? "mode unset"} · {company.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="quiet" size="sm">
                    <Link href={`/owner/companies/${company.id}`}>Open</Link>
                  </Button>
                  <form action={setCompanyStatus}>
                    <input type="hidden" name="company_id" value={company.id} />
                    <input type="hidden" name="status" value={company.status === "active" ? "suspended" : "active"} />
                    <Button type="submit" size="sm" variant={company.status === "active" ? "ghost" : "primary"}>
                      {company.status === "active" ? "Suspend" : "Reactivate"}
                    </Button>
                  </form>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(company.stores ?? []).map((store) => (
                  <li key={store.id} className="rounded-full border border-line px-3 py-1 text-xs">
                    {store.name} · {store.type}
                    {store.active ? "" : " · inactive"}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
