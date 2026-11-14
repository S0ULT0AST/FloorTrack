import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/utils";
import { ReissueButton } from "@/components/settings/forms";

export default async function OwnerCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, status, timezone, company_settings(account_access_mode), stores(id, name, type, active)")
    .eq("id", id)
    .maybeSingle();
  if (!company) notFound();

  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, username, status, roles(name)")
    .eq("company_id", id)
    .eq("status", "pending");

  const settings = Array.isArray(company.company_settings) ? company.company_settings[0] : company.company_settings;
  const stores = company.stores ?? [];
  const freshToken = query.invite;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">{company.status}</p>
        <h1 className="mt-1 text-3xl font-bold">{company.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {company.timezone} · {settings?.account_access_mode} · /c/{company.slug}/join
        </p>
      </header>
      {freshToken ? (
        <section className="rounded-xl border border-amber bg-raised p-5">
          <h2 className="font-semibold">Hand this to the first manager</h2>
          <p className="mt-2 break-all font-mono text-sm">
            {appOrigin()}/invite/{freshToken}
          </p>
          <p className="mt-2 text-sm text-muted">
            The link is shown once. If you lose it, issue a new one below. No email is sent.
          </p>
        </section>
      ) : null}
      <section className="rounded-xl border border-line bg-raised p-5">
        <h2 className="font-semibold">Sites</h2>
        <ul className="mt-3 grid gap-2">
          {stores.map((store: { id: string; name: string; type: string; active: boolean }) => (
            <li key={store.id} className="text-sm">
              {store.name} · {store.type}
              {store.active ? "" : " · inactive"}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-line bg-raised p-5">
        <h2 className="font-semibold">Pending invites</h2>
        {(invites ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">No pending invites.</p> : null}
        <ul className="mt-3 grid gap-3">
          {(invites ?? []).map((invite) => {
            const role = Array.isArray(invite.roles) ? invite.roles[0] : invite.roles;
            return (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{invite.email}</p>
                  <p className="text-sm text-muted">
                    {invite.username} · {role?.name}
                  </p>
                </div>
                <ReissueButton inviteId={invite.id} />
              </li>
            );
          })}
        </ul>
      </section>
      <Link href="/owner" className="text-sm text-amber">
        All companies
      </Link>
    </div>
  );
}

