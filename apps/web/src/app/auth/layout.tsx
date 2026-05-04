import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <div className="shell flex min-h-screen flex-col page-y">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="pin-dot">Y</span>
            <span className="font-display text-lg font-semibold text-ink">youin</span>
          </Link>
          <p className="font-mono text-[0.6875rem] text-ink-3">Workspace access</p>
        </header>

        <div className="h-px bg-rule" />

        <main className="grid flex-1 items-center gap-12 py-8 md:grid-cols-[1.12fr_1fr] md:gap-16 md:py-12">
          <section className="section-block">
            <div>
              <p className="text-eyebrow mb-2">youin auth</p>
              <h1 className="text-editorial-md text-ink">Review faster. Ship&nbsp;cleaner.</h1>
            </div>

            <p className="max-w-[46ch] text-[0.9375rem] leading-relaxed text-ink-2">
              Sign in to route live feedback into tickets with context attached. Your reviewer stays on the page, your developer opens a complete brief.
            </p>

            <div className="max-w-[32rem] overflow-hidden rounded-lg border border-rule">
              <div className="grid grid-cols-3 gap-px bg-rule">
                <Stat label="Teams" value="236" />
                <Stat label="Marks / day" value="12.4k" />
                <Stat label="Median triage" value="11m" />
              </div>
            </div>

            <ul className="space-y-1.5 text-[0.8125rem] leading-relaxed text-ink-2">
              <li>Built for agencies and product teams working on live pages.</li>
              <li>One accent color, one source of truth, one workflow.</li>
              <li>Less QA theater. More resolved decisions.</li>
            </ul>
          </section>

          <section className="w-full md:justify-self-end md:max-w-[480px]">{children}</section>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-2 px-4 py-3.5">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-1.5 font-display text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
