import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const loopSteps = [
  {
    num: "01",
    title: "Mark an element",
    body: "Click anything on your app from the Chrome extension or the npm dev dep. Selector, viewport, browser, and screenshot are captured automatically.",
  },
  {
    num: "02",
    title: "Comment with context",
    body: "Write only the intent. URL, device details, and element reference are already attached for whoever picks it up.",
  },
  {
    num: "03",
    title: "Ship a ready ticket",
    body: "Push to Linear, GitHub, or Jira. The issue arrives with repro details, screenshot, and discussion thread pre-filled.",
  },
];

const personas = [
  {
    role: "Product teams",
    detail: "3-15 people",
    body: "Designers, PMs, and devs annotating the same live surface. Replaces scattered Slack threads and Linear backlogs you keep meaning to clean up.",
  },
  {
    role: "Solo devs",
    detail: "Indie + small teams",
    body: "Install youin as an npm dev dep. Treat your own app as a spatial to-do list — the fix lives where the bug lives.",
  },
  {
    role: "Web agencies",
    detail: "5-50 people",
    body: "Multi-client review at scale. Guest links keep clients in your app, not in their inbox.",
  },
];

const tiers = [
  {
    name: "Solo",
    price: "\u20AC29",
    period: "/ month",
    blurb: "For indie devs who think in pages.",
    cta: "Start 14-day trial",
    features: ["1 seat", "Chrome extension + npm dev dep", "Unlimited spaces & marks", "50 AI tickets / mo", "GitHub, Linear, Jira"],
  },
  {
    name: "Team",
    price: "\u20AC79",
    period: "/ month",
    blurb: "For product teams shipping weekly.",
    cta: "Start 14-day trial",
    features: ["Up to 10 seats", "Everything in Solo", "Unlimited AI tickets", "Space archiving", "Team invites"],
    highlighted: true,
  },
  {
    name: "Agency",
    price: "\u20AC149",
    period: "/ month",
    blurb: "For client-facing teams.",
    cta: "Talk to us",
    features: ["Unlimited seats", "Everything in Team", "Client guest links", "White-label widget", "Priority support"],
  },
];

const navItems = [
  { href: "#problem", label: "Problem" },
  { href: "#loop", label: "How it works" },
  { href: "#who", label: "Who it\u2019s for" },
  { href: "#pricing", label: "Pricing" },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = Boolean(user);

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="shell flex items-center justify-between py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="pin-dot">Y</span>
            <span className="font-display text-lg font-semibold">youin</span>
          </Link>
          <nav className="hidden items-center gap-5 text-[0.8125rem] text-ink-2 md:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-ink">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <Button asChild size="sm" className="h-9 px-3.5 text-[0.8125rem]">
                <Link href="/dashboard?space=all" className="inline-flex items-center gap-2">
                  Open dashboard
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Link href="/auth/sign-in" className="hidden text-[0.8125rem] font-medium text-ink-2 hover:text-ink sm:block">
                  Sign in
                </Link>
                <ChromeCtaButton href="#install" compact />
              </>
            )}
          </div>
        </div>
        {/* Mobile nav */}
        <div className="shell pb-3 md:hidden">
          <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-rule px-3 text-[0.8125rem] text-ink-2"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="section-stack page-y-loose">
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="shell">
          <div className="grid gap-10 md:items-start md:gap-14">
            <div>
              <h1 className="text-editorial text-ink">
                Your to-do list lives on your&nbsp;app.
              </h1>
              <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-ink-2">
                Click any element. Write what needs to change. Push it as a Linear, GitHub, or Jira ticket — all without leaving your live app. No spreadsheets. No Slack chains.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ChromeCtaButton href="#install">Add to Chrome</ChromeCtaButton>
                <SecondaryCtaButton href="#loop">See the loop</SecondaryCtaButton>
              </div>
              <p className="mt-5 font-mono text-[0.6875rem] text-ink-3">
                Chrome extension &middot; npm dev dep &middot; Linear &middot; GitHub &middot; Jira
              </p>
            </div>
          </div>
        </section>

        <div className="shell"><div className="h-px bg-rule" /></div>

        {/* ── Problem ──────────────────────────────────────── */}
        <section id="problem" className="shell section-block">
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:gap-12">
            <div>
              <h2 className="text-editorial-md text-ink">
                Five steps for a five-second observation.
              </h2>
            </div>
            <div className="space-y-4">
              <p className="text-[0.9375rem] leading-relaxed text-ink-2">
                Designers and PMs lose context while moving across tools. Developers receive summaries instead of the moment that triggered the feedback.
              </p>
              <div className="rounded-lg bg-paper-2 px-4 py-3">
                <p className="text-eyebrow mb-2">The old loop</p>
                <p className="text-[0.8125rem] leading-relaxed text-ink-3">
                  Screenshot &rarr; annotate &rarr; paste in chat &rarr; explain context &rarr; wait for questions &rarr; repeat.
                </p>
              </div>
              <div className="rounded-lg bg-mark-soft px-4 py-3">
                <p className="text-eyebrow mb-2">With youin</p>
                <p className="text-[0.8125rem] font-medium leading-relaxed text-ink">
                  Click &rarr; comment &rarr; done. Context is captured, the ticket writes itself.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="shell"><div className="h-px bg-rule" /></div>

        {/* ── How it works ─────────────────────────────────── */}
        <section id="loop" className="shell section-block">
          <div className="mb-10">
            <p className="text-eyebrow mb-2">How it works</p>
            <h2 className="text-editorial-md text-ink">Three moves. One loop.</h2>
          </div>

          <div className="annotation-rail space-y-8 lg:ml-4">
            {loopSteps.map((step) => (
              <div key={step.num} className="grid gap-2 md:grid-cols-[120px_1fr] md:gap-6">
                <span className="font-display text-[2rem] font-semibold leading-none text-mark">{step.num}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 max-w-[52ch] text-[0.8125rem] leading-relaxed text-ink-2">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="shell"><div className="h-px bg-rule" /></div>

        {/* ── Who it's for ─────────────────────────────────── */}
        <section id="who" className="shell section-block">
          <div className="mb-10">
            <p className="text-eyebrow mb-2">Who it&rsquo;s for</p>
            <h2 className="text-editorial-md text-ink">Built for people who notice first.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {personas.map((p, i) => (
              <div
                key={p.role}
                className={`rounded-lg border border-rule bg-paper-2 p-5 ${i === 0 ? "md:col-span-2 md:row-span-1" : ""}`}
              >
                <p className="text-eyebrow">{p.detail}</p>
                <h3 className="mt-1.5 font-display text-lg font-semibold text-ink">{p.role}</h3>
                <p className="mt-2 max-w-[48ch] text-[0.8125rem] leading-relaxed text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="shell"><div className="h-px bg-rule" /></div>

        {/* ── Pricing ──────────────────────────────────────── */}
        <section id="pricing" className="shell section-block">
          <div className="mb-10">
            <p className="text-eyebrow mb-2">Pricing</p>
            <h2 className="text-editorial-md text-ink">Paid from day&nbsp;one.</h2>
            <p className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-2">
              No free tier. Either the product earns its keep on day one, or it doesn&rsquo;t.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`flex flex-col rounded-xl border p-6 ${tier.highlighted
                    ? "border-mark bg-mark-soft"
                    : "border-rule bg-paper-2"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-ink">{tier.name}</h3>
                  {tier.highlighted ? (
                    <Badge className="bg-mark text-paper text-[0.625rem]">Popular</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[0.8125rem] text-ink-2">{tier.blurb}</p>
                <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
                  {tier.price}
                  <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-3">{tier.period}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-[0.8125rem] text-ink-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-mark" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.highlighted ? "default" : "outline"}
                  className="mt-6 w-full"
                  asChild
                >
                  <a href="#install">{tier.cta}</a>
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section id="install" className="border-t border-rule bg-paper-2">
          <div className="shell page-y-loose grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="text-editorial-md text-ink">
                Stop describing the thing you can point&nbsp;at.
              </h2>
              <p className="mt-3 max-w-[48ch] text-[0.9375rem] leading-relaxed text-ink-2">
                The next time someone spots a live issue, leave a mark instead of a message thread.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ChromeCtaButton href="#install">Add to Chrome</ChromeCtaButton>
                <SecondaryCtaButton href="/contact">Talk to a human</SecondaryCtaButton>
              </div>
            </div>

            <div className="rounded-xl border border-rule bg-paper p-5">
              <p className="text-eyebrow mb-4">At a glance</p>
              <div className="space-y-3 text-[0.8125rem]">
                <div className="flex justify-between">
                  <span className="text-ink-2">Onboarding</span>
                  <span className="font-medium text-ink">~60 seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Tabs to switch</span>
                  <span className="font-medium text-ink">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Connectors</span>
                  <span className="font-medium text-ink">GitHub, Linear, Jira</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-rule bg-paper py-6">
        <div className="shell flex items-center justify-between">
          <p className="font-mono text-[0.6875rem] text-ink-3">&copy; 2026 youin</p>
          <div className="flex gap-4 text-[0.75rem] text-ink-3">
            <a href="#" className="hover:text-ink">Terms</a>
            <a href="#" className="hover:text-ink">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChromeCtaButton({
  href,
  children,
  compact,
}: {
  href: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Button
      size={compact ? "sm" : "lg"}
      asChild
      className={compact ? "h-9 px-3.5 text-[0.8125rem]" : "h-11 px-5 text-[0.875rem] font-semibold"}
    >
      <a href={href} className="inline-flex items-center gap-2">
        <ChromeGlyph className={compact ? "size-3.5" : "size-4"} />
        <span>{children ?? "Add to Chrome"}</span>
        {!compact ? <ArrowRight className="size-4" /> : null}
      </a>
    </Button>
  );
}

function ChromeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#ffffff" />
      <path d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-4.33 2.5L5.5 5.75A10 10 0 0 1 12 2z" fill="#ea4335" />
      <path d="M3.34 7A10 10 0 0 0 12 22l4.33-7.5A5 5 0 0 1 12 17H7.67L3.34 9.5V7z" fill="#34a853" />
      <path d="M20.66 7A10 10 0 0 1 12 22l4.33-7.5A5 5 0 0 0 12 7h8.66z" fill="#fbbc05" />
      <circle cx="12" cy="12" r="4.1" fill="#4285f4" />
    </svg>
  );
}

function SecondaryCtaButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button size="lg" variant="outline" asChild className="h-11 px-5 text-[0.875rem]">
      <a href={href} className="inline-flex items-center gap-2">
        <span>{children}</span>
        <ArrowRight className="size-4" />
      </a>
    </Button>
  );
}
