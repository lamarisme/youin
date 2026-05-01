export function CtaFooter() {
  return (
    <section id="install" className="relative overflow-hidden bg-ink text-paper">
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/55">
              Install · 60 seconds
            </span>
            <h2 className="mt-5 font-display text-[clamp(2.25rem,4.5vw,4rem)] font-medium leading-[0.98] tracking-[-0.03em] text-balance">
              Stop describing the thing you can{" "}
              <span className="bg-mark px-2 text-paper">point at</span>.
            </h2>
            <p className="mt-7 max-w-[44ch] text-[1.05rem] leading-relaxed text-paper/70">
              Install Pin in your team&rsquo;s browsers. The next time someone
              spots a problem on the live site, they leave a pin instead of a
              Slack message. The dev gets a real ticket. Everyone moves on.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full bg-mark px-5 py-3 text-[15px] font-medium text-paper hover:bg-mark-bright transition-colors"
              >
                Add to Chrome — free
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="mailto:hello@pin.tools"
                className="inline-flex items-center gap-2 rounded-full border border-paper/20 px-5 py-3 text-[15px] font-medium text-paper hover:bg-paper/10 transition-colors"
              >
                Talk to a human
              </a>
            </div>
          </div>

          <aside className="grid content-start gap-6 self-end">
            <Stat n="60s" label="Onboarding, click to first pin" />
            <Stat n="0" label="Tabs you have to leave" />
            <Stat n="3" label="Connectors at launch — GitHub, Linear, Jira" />
          </aside>
        </div>
      </div>

      <footer className="border-t border-paper/10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex items-center gap-2.5">
            <span
              className="pin-dot !h-6 !w-6 !text-[0.66rem] [--pin-ring:transparent]"
            >
              P
            </span>
            <span className="font-display text-[1.05rem] font-semibold tracking-tight">
              Pin
            </span>
            <span className="ml-3 font-mono text-[11px] text-paper/50">
              v0.9
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper/55">
            <a href="#" className="hover:text-paper">
              Changelog
            </a>
            <a href="#" className="hover:text-paper">
              GitHub
            </a>
            <a href="#" className="hover:text-paper">
              Privacy
            </a>
            <a href="#" className="hover:text-paper">
              Terms
            </a>
          </nav>
        </div>
      </footer>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="border-t border-paper/15 pt-4">
      <div className="font-display text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums">
        {n}
      </div>
      <div className="mt-2 max-w-[28ch] text-[13.5px] text-paper/70">
        {label}
      </div>
    </div>
  );
}
