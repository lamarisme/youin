const rows = [
  {
    against: "Jam.dev",
    they: "Bug videos for QA. Built for “something is broken.”",
    pin: "Spatial marks for design review. Built for “this feels off.”",
  },
  {
    against: "Vercel Comments",
    they: "Only works on sites you host on Vercel.",
    pin: "Works on any URL — production, staging, competitor sites.",
  },
  {
    against: "Figma Comments",
    they: "Live on the design file. Disappear the moment design ships.",
    pin: "Live on the shipped UI. Pick up exactly where Figma stops.",
  },
  {
    against: "Slack + screenshots",
    they: "Loses context, loses thread, loses the ticket.",
    pin: "Keeps everything attached to the element it was about.",
  },
];

export function Comparison() {
  return (
    <section id="vs" className="relative bg-paper-2">
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
        <div className="max-w-[40rem]">
          <span className="text-eyebrow">Where it fits</span>
          <h2 className="mt-4 text-editorial-md text-ink text-balance">
            Not another bug tool. A different shape entirely.
          </h2>
        </div>

        <div className="mt-14 overflow-hidden rounded-2xl border border-rule bg-paper">
          <div className="hidden grid-cols-[12rem_1fr_1fr] gap-px border-b border-rule bg-rule font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 md:grid">
            <div className="bg-paper-2 px-6 py-3">Tool</div>
            <div className="bg-paper-2 px-6 py-3">Their thing</div>
            <div className="bg-paper-2 px-6 py-3">Markly&rsquo;s thing</div>
          </div>

          {rows.map((row) => (
            <div
              key={row.against}
              className="group grid gap-y-3 border-b border-rule px-6 py-6 transition-colors last:border-b-0 hover:bg-paper-2/60 md:grid-cols-[12rem_1fr_1fr] md:gap-x-px md:gap-y-0 md:px-0 md:py-0"
            >
              <div className="font-display text-[1.05rem] font-semibold text-ink md:px-6 md:py-6">
                <span className="text-ink-3">vs</span> {row.against}
              </div>
              <p className="text-[14.5px] leading-relaxed text-ink-2 md:border-l md:border-rule md:px-6 md:py-6">
                {row.they}
              </p>
              <p className="text-[14.5px] leading-relaxed text-ink md:border-l md:border-rule md:px-6 md:py-6">
                {row.pin}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="rule mx-auto max-w-[1400px]" />
    </section>
  );
}
