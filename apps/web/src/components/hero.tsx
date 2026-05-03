import { Pin } from "./pin";
import { ProductDemo } from "./product-demo";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper-grain">
      <div className="mx-auto grid max-w-[1400px] gap-16 px-6 pb-24 pt-16 md:px-10 md:pb-32 md:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
        {/* Left — copy */}
        <div className="relative">
          <div className="flex items-center gap-3 text-eyebrow">
            <span className="block h-px w-6 bg-ink-3" />
            <span>v0.9 · for design-led teams</span>
          </div>

          <h1 className="mt-7 text-editorial text-ink text-balance">
            The feedback layer for the live web.
          </h1>

          <p className="mt-7 max-w-[34ch] text-[1.125rem] leading-[1.55] text-ink-2">
            Click any element on any live site. Mark a comment. Ship the ticket.
            Without leaving the page, without writing a brief.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#install"
              className="inline-flex items-center gap-2.5 rounded-full bg-mark px-5 py-3 text-[15px] font-medium text-paper hover:bg-mark-bright transition-colors"
            >
              Add to Chrome — free
            </a>
            <a
              href="#loop"
              className="inline-flex items-center gap-2 rounded-full border border-rule px-5 py-3 text-[15px] font-medium text-ink hover:bg-paper-2 transition-colors"
            >
              See the loop
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>

          {/* Inline editor's mark — the meta-pin, always visible */}
          <div className="mt-10 flex items-start gap-3 max-w-[42ch] border-t border-rule pt-5">
            <Pin n={2} className="!h-5 !w-5 !text-[0.62rem] shrink-0 mt-0.5" />
            <p className="font-mono text-[12px] leading-relaxed text-ink-3">
              <span className="text-ink-2">Editor&rsquo;s note ·</span> this
              page was reviewed in youin. Each numbered mark is a real annotation
              we left for ourselves.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
            <span>Chrome MV3</span>
            <span className="block h-px w-3 bg-rule" />
            <span>GitHub · Linear · Jira</span>
            <span className="block h-px w-3 bg-rule" />
            <span>Self-host (GDPR)</span>
          </div>
        </div>

        {/* Right — demo */}
        <div className="relative lg:pt-2">
          <ProductDemo />
        </div>
      </div>

      <div className="rule mx-auto max-w-[1400px]" />
    </section>
  );
}
