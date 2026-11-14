"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">Something broke</p>
      <h1 className="mt-2 text-3xl font-bold">FloorTrack couldn&apos;t finish that.</h1>
      <p className="mt-3 text-sm text-muted">{error.message}</p>
      <button className="mt-6 rounded-md bg-amber px-4 py-2 text-sm font-semibold text-amber-ink" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
