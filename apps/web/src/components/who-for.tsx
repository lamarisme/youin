const personas = [
  {
    role: "Web agencies",
    size: "5–50 people",
    body: "Multiple client sites, weekly review calls, designers and PMs trying to be precise without being technical.",
    primary: true,
  },
  {
    role: "Indie dev teams",
    size: "PM + 1–3 devs",
    body: "Tiny teams that ship fast and skip the QA layer. youin replaces the whole feedback chain with a comment.",
    primary: false,
  },
  {
    role: "EU agencies",
    size: "GDPR-bound",
    body: "Client data must stay in your infra. Self-host the whole stack with the open-source Docker image.",
    primary: false,
  },
];

export function WhoFor() {
  return (
    <section id="who" className="relative">
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-20">
          <div>
            <span className="text-eyebrow">Who it&rsquo;s for</span>
            <h2 className="mt-4 text-editorial-md text-ink text-balance">
              Designed for the people who notice first.
            </h2>
          </div>
          <p className="max-w-[55ch] self-end text-[1.05rem] leading-relaxed text-ink-2">
            The reviewer doesn&rsquo;t need to know what a console is. The
            developer doesn&rsquo;t need to translate a screenshot. youin is
            built for both halves of the room.
          </p>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-3">
          {personas.map((p) => (
            <div
              key={p.role}
              className={`flex flex-col p-7 ${
                p.primary ? "bg-paper-2" : "bg-paper"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[1.35rem] font-semibold tracking-tight">
                  {p.role}
                </h3>
                {p.primary && (
                  <span className="rounded-full bg-mark px-2 py-0.5 font-mono text-[10px] text-paper">
                    primary
                  </span>
                )}
              </div>
              <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                {p.size}
              </span>
              <p className="mt-5 max-w-[34ch] text-[14px] leading-relaxed text-ink-2">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="rule mx-auto max-w-[1400px]" />
    </section>
  );
}
