export default function Loading() {
  return (
    <main className="state-page" aria-busy="true">
      <div className="state-page__identity">
        <span className="eyebrow">TI15 · Shanghai · August 13–23</span>
        <h1>The International <strong>2026</strong></h1>
        <p>Loading the latest verified tournament state…</p>
      </div>
      <div className="state-skeleton" aria-hidden>
        <span /><span /><span /><span />
      </div>
      <span className="sr-only">Loading tournament data</span>
    </main>
  );
}
