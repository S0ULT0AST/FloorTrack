import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-controls";

export function AuthCard({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/login" className="text-xl font-bold tracking-tight">
          Floor<span className="text-amber">Track</span>
        </Link>
        <ThemeToggle />
      </div>
      <section className="rounded-2xl border border-line bg-raised p-6 shadow-[var(--shadow)]">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{lede}</p>
        <div className="mt-6 grid gap-4">{children}</div>
      </section>
      {footer ? <div className="mt-4 text-sm text-muted">{footer}</div> : null}
    </main>
  );
}
