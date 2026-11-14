import { EmailChangeForm, HomeStoreForm, PasswordChangeForm, UsernameForm } from "@/components/auth/forms";
import { requireWorkspace } from "@/lib/auth/session";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { context, membership } = await requireWorkspace();
  const params = await searchParams;
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">Account</p>
        <h1 className="mt-1 text-3xl font-bold">{context.display_name}</h1>
        <p className="mt-1 text-sm text-muted">{context.email}</p>
        {params.password === "updated" ? (
          <p className="mt-3 text-sm text-ok">Password updated.</p>
        ) : null}
      </header>
      <section className="grid gap-6 rounded-xl border border-line bg-raised p-5 md:grid-cols-2">
        <div>
          <h2 className="font-semibold">Password</h2>
          <div className="mt-3">
            <PasswordChangeForm />
          </div>
        </div>
        <div>
          <h2 className="font-semibold">Email</h2>
          <div className="mt-3">
            <EmailChangeForm />
          </div>
        </div>
        <UsernameForm companyId={membership.company_id} username={membership.username} />
        <HomeStoreForm
          companyId={membership.company_id}
          stores={membership.stores}
          current={membership.primary_store_id}
        />
      </section>
    </div>
  );
}
