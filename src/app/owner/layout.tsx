import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/lib/auth/actions";
import { requireSignedIn } from "@/lib/auth/session";
import { ThemeSync, ThemeToggle } from "@/components/theme/theme-controls";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Opening the owner desk…</p>}>
      <OwnerFrame>{children}</OwnerFrame>
    </Suspense>
  );
}

async function OwnerFrame({ children }: { children: React.ReactNode }) {
  const context = await requireSignedIn();
  if (!context.is_platform_admin) redirect("/no-access");
  return (
    <div className="min-h-screen">
      <ThemeSync theme={context.theme} />
      <header className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-4">
        <Link href="/owner" className="text-lg font-bold tracking-tight">
          Floor<span className="text-amber">Track</span>
          <span className="ml-2 font-mono text-xs font-normal text-muted">Owner</span>
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/owner">Companies</Link>
          <Link href="/owner/companies/new">New company</Link>
          {(context.memberships?.length ?? 0) > 0 ? <Link href="/map">Open floor</Link> : null}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle persist />
          <span className="font-mono text-xs text-muted">{context.email}</span>
          <form action={signOut}>
            <button className="text-sm text-muted" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="px-4 py-6">{children}</main>
    </div>
  );
}
