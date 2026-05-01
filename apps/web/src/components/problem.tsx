import { Pin } from "./pin";

const chain = [
  { n: 1, label: "Screenshot", tool: "Cleanshot" },
  { n: 2, label: "Annotate", tool: "Figma" },
  { n: 3, label: "Drag into", tool: "Slack" },
  { n: 4, label: "Write context", tool: "(badly)" },
  { n: 5, label: "Wait", tool: "for the dev" },
];

export function Problem() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-20">
          <div>
            <span className="text-eyebrow">The problem</span>
            <h2 className="mt-4 text-editorial-md text-ink text-balance">
              Five steps for a five-second observation.
            </h2>
          </div>

          <div className="relative">
            <p className="max-w-[55ch] text-[1.05rem] leading-relaxed text-ink-2">
              Designers and PMs spot something on the live site. Then they
              screenshot, annotate in Figma or Cleanshot, paste into Slack,
              write context the developer still misunderstands. By the time the
              ticket exists, the moment is gone and the meaning is lost.
            </p>

            <ol className="mt-10 grid gap-3">
              {chain.map((step, i) => (
                <li
                  key={step.n}
                  className="flex items-baseline gap-5 border-t border-rule pt-3"
                  style={{
                    color: `oklch(${20 + i * 8}% 0.012 60)`,
                  }}
                >
                  <span className="font-mono text-[11px] tabular-nums text-ink-3">
                    0{step.n}
                  </span>
                  <span className="font-display text-xl font-medium tracking-tight">
                    {step.label}
                  </span>
                  <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                    {step.tool}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-10 max-w-[40ch] font-display text-[1.5rem] font-medium leading-tight tracking-tight text-ink">
              <span className="bg-mark-soft px-1.5 text-mark">Pin</span>{" "}
              collapses all five into one click.
            </p>

            {/* Inline editor's mark */}
            <div className="mt-8 flex items-start gap-3 max-w-[44ch] border-t border-rule pt-5">
              <Pin n={3} className="!h-5 !w-5 !text-[0.62rem] shrink-0 mt-0.5" />
              <p className="font-mono text-[12px] leading-relaxed text-ink-3">
                <span className="text-ink-2">Editor&rsquo;s note ·</span> bug
                tools fix {"“something is broken.”"} We fix {"“this spacing"}{" "}
                {"feels off.”"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="rule mx-auto max-w-[1400px]" />
    </section>
  );
}
