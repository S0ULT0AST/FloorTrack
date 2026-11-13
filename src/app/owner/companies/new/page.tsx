import { NewCompanyForm } from "@/components/owner/new-company-form";

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">Handoff</p>
      <h1 className="mt-1 text-3xl font-bold">New company</h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm text-muted">
        You stay the platform owner. The first manager gets a link, sets a password, and then runs users and sites. There is no public “first person in is admin” path.
      </p>
      <div className="rounded-xl border border-line bg-raised p-5">
        <NewCompanyForm />
      </div>
    </div>
  );
}
