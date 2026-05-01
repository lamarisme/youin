import { Pin } from "./pin";

const MOCK_TIERS = [
  { name: "Hobby", price: "$19" },
  { name: "Pro", price: "$49" },
  { name: "Business", price: "$99" },
];

export function ProductDemo() {
  return (
    <div className="relative">
      {/* Faux browser */}
      <div className="relative overflow-hidden rounded-2xl border border-rule bg-white shadow-[0_20px_60px_-30px_oklch(20%_0.012_60_/_0.35),0_4px_18px_-12px_oklch(20%_0.012_60_/_0.18)]">
        {/* Window chrome */}
        <div className="flex items-center gap-3 border-b border-rule bg-paper-2 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="block h-3 w-3 rounded-full bg-[oklch(75%_0.04_25)]" />
            <span className="block h-3 w-3 rounded-full bg-[oklch(82%_0.06_85)]" />
            <span className="block h-3 w-3 rounded-full bg-[oklch(78%_0.08_150)]" />
          </div>
          <div className="ml-2 flex flex-1 items-center gap-2 rounded-md bg-paper px-3 py-1 font-mono text-[11px] text-ink-3">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            acme.studio/pricing
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-mark-soft px-2 py-1 font-mono text-[10px] font-medium text-mark">
            <span className="block h-1.5 w-1.5 rounded-full bg-mark animate-pulse" />
            Pin · live
          </span>
        </div>

        {/* Mock website body */}
        <div className="relative grid gap-8 px-8 py-10 md:px-12 md:py-14">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-semibold tracking-tight">
              acme
            </span>
            <div className="hidden items-center gap-6 text-[12px] text-ink-3 md:flex">
              <span>Product</span>
              <span>Customers</span>
              <span>Pricing</span>
              <span className="rounded-full bg-ink px-3 py-1 text-paper">
                Sign up
              </span>
            </div>
          </div>

          <div className="grid gap-3 max-w-md">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              Pricing — simple
            </span>
            <h3 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight">
              Built for teams that ship.
            </h3>
            <p className="text-[13px] leading-relaxed text-ink-2 max-w-sm">
              Three tiers, no annual lock-in, cancel any time. The plan you
              choose today scales as your team grows.
            </p>
          </div>

          {/* Pricing cards inside the mock — middle card carries the pin */}
          <div className="relative grid grid-cols-3 gap-3">
            {MOCK_TIERS.map((tier, i) => {
              const isPinned = i === 1;
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-xl border p-4 ${
                    isPinned ? "border-rule bg-paper-2" : "border-rule bg-white"
                  }`}
                >
                  <div className="font-display text-sm font-semibold">
                    {tier.name}
                  </div>
                  <div className="mt-2 font-display text-xl font-semibold tracking-tight">
                    {tier.price}
                    <span className="ml-0.5 text-[10px] font-normal text-ink-3">
                      /mo
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[90, 70, 60].map((w, j) => (
                      <div
                        key={j}
                        className="h-1.5 rounded-full bg-paper-3"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>

                  {isPinned && (
                    <>
                      <div className="absolute inset-0 rounded-xl ring-2 ring-mark/70 ring-offset-2 ring-offset-paper-2 pointer-events-none" />
                      <div className="absolute -top-3 -right-3">
                        <Pin n={1} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Comment popover — anchored to the right edge of the cards row */}
          <div className="pointer-events-none absolute z-10 right-4 md:right-6 top-[58%] w-[260px] sm:w-[268px]">
            <div className="rounded-xl border border-rule bg-white p-3.5 shadow-[0_18px_40px_-18px_oklch(20%_0.012_60_/_0.35)]">
              <div className="flex items-center gap-2">
                <span className="block h-6 w-6 rounded-full bg-[oklch(80%_0.06_50)] ring-2 ring-paper" />
                <div className="text-[12px] font-medium text-ink">Mira</div>
                <div className="ml-auto font-mono text-[10px] text-ink-3">
                  just now
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-ink">
                The middle plan should read{" "}
                <span className="bg-mark-soft px-1 text-mark">
                  {"“most popular”"}
                </span>{" "}
                not just be highlighted. Clients miss it.
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-rule pt-2.5 font-mono text-[10px] text-ink-3">
                <span>
                  <span className="text-ink-2">selector</span>{" "}
                  .pricing__card—featured h3
                </span>
                <span>1440 × 900</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-ticket card, off-window on the right */}
      <div className="absolute -bottom-10 -right-4 hidden w-[320px] rounded-xl border border-rule bg-paper p-4 shadow-[0_22px_50px_-20px_oklch(20%_0.012_60_/_0.4)] md:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-ink"
              aria-hidden
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.18c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.93 10.93 0 0 1 5.74 0c2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
            </svg>
            <span className="font-mono text-[11px] text-ink-2">
              github.com/acme/site · #482
            </span>
          </div>
          <span className="rounded-full bg-mark-soft px-2 py-0.5 font-mono text-[10px] font-medium text-mark">
            auto
          </span>
        </div>
        <h4 className="mt-2.5 font-display text-[14px] font-semibold leading-snug">
          {"Pricing: surface “most popular” label on Pro plan"}
        </h4>
        <ul className="mt-2 space-y-1 text-[11.5px] leading-snug text-ink-2">
          <li className="flex gap-1.5">
            <span className="text-ink-3">·</span> Repro: viewport 1440×900,
            Chrome 121
          </li>
          <li className="flex gap-1.5">
            <span className="text-ink-3">·</span> Element:{" "}
            <span className="font-mono">.pricing__card—featured h3</span>
          </li>
          <li className="flex gap-1.5">
            <span className="text-ink-3">·</span> Reporter: Mira (design)
          </li>
        </ul>
      </div>
    </div>
  );
}
