/**
 * Shown while the server render waits on OpenDota. The shape matches the real
 * page — header, live slot, next up, standings — so the layout does not jump
 * when the data lands. No spinner: a skeleton that mirrors the page reads as
 * fast, a spinner reads as stuck.
 */
export default function Loading() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 pb-16" aria-busy="true">
      <header>
        <h1 className="text-2xl font-bold tracking-wide text-[#c9d3dc]">The International 2026</h1>
        <p className="text-sm text-[#6b7785]">Shanghai · Aug 13–23 · all times Eastern</p>
        <p className="mt-1 text-xs text-[#6b7785]">Loading the latest scores…</p>
      </header>

      <div className="flex flex-col gap-2" aria-hidden>
        <Bar className="h-24" />
        <Bar className="h-16" />
        <Bar className="h-16" />
        <Bar className="h-64" />
      </div>

      <span className="sr-only">Loading tournament data</span>
    </main>
  );
}

function Bar({ className }: { className: string }) {
  return <div className={`w-full border border-[#232a33] bg-[#151a21] ${className}`} />;
}
