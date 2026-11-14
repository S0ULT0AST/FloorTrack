export function LaterPhase({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-dashed border-line bg-raised p-6 shadow-[var(--shadow)] sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">{kicker}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">{body}</p>
    </section>
  );
}
