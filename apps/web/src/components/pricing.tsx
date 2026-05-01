const tiers = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    blurb: "For trying the loop on a single project.",
    features: [
      "1 active workspace",
      "Unlimited pins",
      "Auto-context capture",
      "3 AI tickets / month",
    ],
    cta: "Add to Chrome",
    primary: false,
  },
  {
    name: "Team",
    price: "€29",
    period: "per workspace · month",
    blurb: "For studios juggling 3+ live projects at once.",
    features: [
      "Unlimited workspaces",
      "Up to 10 members",
      "Unlimited AI tickets",
      "GitHub · Linear · Jira sync",
      "Workspace archiving",
    ],
    cta: "Start 14-day trial",
    primary: true,
    badge: "Most popular",
  },
  {
    name: "Agency",
    price: "€79",
    period: "per workspace · month",
    blurb: "For client-facing teams that need control + GDPR.",
    features: [
      "Everything in Team",
      "Unlimited members",
      "Client guest links",
      "Self-host (Docker)",
      "Local AI model (Ollama)",
      "Priority support",
    ],
    cta: "Talk to us",
    primary: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative">
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-20">
          <div>
            <span className="text-eyebrow">Pricing</span>
            <h2 className="mt-4 text-editorial-md text-ink text-balance">
              Per workspace, not per seat.
            </h2>
          </div>
          <p className="max-w-[55ch] self-end text-[1.05rem] leading-relaxed text-ink-2">
            Add the whole team for free. You only pay when you outgrow a single
            workspace — usually the moment you start a second client project.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <article
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                t.primary
                  ? "border-mark bg-paper-2"
                  : "border-rule bg-paper"
              }`}
            >
              {t.badge && (
                <span className="absolute -top-3 left-7 rounded-full bg-mark px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper">
                  {t.badge}
                </span>
              )}
              <header>
                <h3 className="font-display text-[1.4rem] font-semibold tracking-tight">
                  {t.name}
                </h3>
                <p className="mt-1.5 text-[13px] text-ink-2">{t.blurb}</p>
              </header>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-[3rem] font-semibold leading-none tracking-tight text-ink">
                  {t.price}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                  {t.period}
                </span>
              </div>
              <ul className="mt-7 space-y-2.5 text-[14px] text-ink">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`mt-1 shrink-0 ${
                        t.primary ? "text-mark" : "text-ink-3"
                      }`}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#install"
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium transition-colors ${
                  t.primary
                    ? "bg-mark text-paper hover:bg-mark-bright"
                    : "border border-rule text-ink hover:bg-paper-2"
                }`}
              >
                {t.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
      <div className="rule mx-auto max-w-[1400px]" />
    </section>
  );
}
