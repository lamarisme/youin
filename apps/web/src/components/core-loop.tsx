import { Pin } from "./pin";

export function CoreLoop() {
  return (
    <section id="loop" className="relative bg-paper-2">
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-20">
          <div>
            <span className="text-eyebrow">How it works</span>
            <h2 className="mt-4 text-editorial-md text-ink text-balance">
              Three moves. One loop. No tab switching.
            </h2>
          </div>
          <p className="max-w-[55ch] text-[1.05rem] leading-relaxed text-ink-2 self-end">
            Every Pin annotation is a complete brief — the element, the
            environment, the intent — captured in the half second between
            noticing and forgetting.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-6">
          <Step
            n={1}
            kicker="Click"
            title="Pin to a real element."
            body="Hover anything on any live page. The picker locks to the underlying CSS selector — not pixel coordinates. Pins survive deploys."
            visual={<PickerVisual />}
          />
          <Step
            n={2}
            kicker="Comment"
            title="Auto-context, no typing."
            body="Console state, viewport, browser, OS, the element selector, a fresh screenshot. Attached to every comment, automatically. The reporter just writes a sentence."
            visual={<ContextVisual />}
          />
          <Step
            n={3}
            kicker="Ticketed"
            title="Ship it to GitHub, Linear, or Jira."
            body="One click. Claude reads the comment + context and writes the issue: title, repro, environment, expected vs actual. The dev opens a ready-to-work ticket."
            visual={<TicketVisual />}
          />
        </div>
      </div>
      <div className="rule mx-auto max-w-[1400px]" />
    </section>
  );
}

function Step({
  n,
  kicker,
  title,
  body,
  visual,
}: {
  n: number;
  kicker: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-rule bg-white">
        {visual}
      </div>
      <div className="mt-5 flex items-baseline gap-3">
        <Pin n={n} className="!h-5 !w-5 !text-[0.62rem]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
          {kicker}
        </span>
      </div>
      <h3 className="mt-3 font-display text-[1.55rem] font-semibold leading-tight tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-[42ch] text-[14.5px] leading-relaxed text-ink-2">
        {body}
      </p>
    </article>
  );
}

function PickerVisual() {
  return (
    <div className="relative h-full w-full bg-white p-6">
      <div className="space-y-3">
        <div className="h-2.5 w-1/3 rounded-full bg-paper-3" />
        <div className="h-2 w-2/3 rounded-full bg-paper-3" />
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-paper-2 p-4">
          <div className="h-1.5 w-1/2 rounded-full bg-paper-3" />
          <div className="mt-2 h-1.5 w-3/4 rounded-full bg-paper-3" />
        </div>
        {/* Highlighted element */}
        <div className="relative rounded-lg bg-paper-2 p-4 outline outline-2 outline-mark outline-offset-2">
          <div className="h-1.5 w-2/3 rounded-full bg-mark/70" />
          <div className="mt-2 h-1.5 w-1/2 rounded-full bg-mark/40" />
          <span
            className="pin-dot absolute -top-2 -right-2 !h-5 !w-5 !text-[0.62rem]"
            aria-hidden
          >
            1
          </span>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 rounded-md bg-ink px-2 py-1 font-mono text-[10px] text-paper">
        div.card.featured &gt; h3
      </div>
    </div>
  );
}

function ContextVisual() {
  const items = [
    ["browser", "Chrome 121"],
    ["viewport", "1440 × 900"],
    ["selector", ".pricing h3"],
    ["console", "0 errors"],
    ["url", "/pricing"],
    ["screenshot", "attached"],
  ];
  return (
    <div className="h-full w-full bg-white p-5">
      <div className="rounded-lg border border-rule bg-paper-2 p-3 text-[12px]">
        <div className="font-display font-semibold text-ink">
          Move &ldquo;most popular&rdquo; label up
        </div>
        <div className="mt-1 text-ink-2">Mira · 11:42</div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
        {items.map(([k, v]) => (
          <li key={k} className="flex items-baseline justify-between gap-2 border-b border-rule pb-1">
            <span className="text-ink-3">{k}</span>
            <span className="text-ink truncate">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TicketVisual() {
  return (
    <div className="h-full w-full bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] text-ink-3">
          <span className="block h-2 w-2 rounded-full bg-mark" /> linear ·
          ACME-482
        </div>
        <span className="rounded-full bg-mark-soft px-2 py-0.5 font-mono text-[10px] text-mark">
          claude
        </span>
      </div>
      <h4 className="mt-3 font-display text-[14px] font-semibold leading-snug">
        Pricing: surface &ldquo;most popular&rdquo; label on Team plan
      </h4>
      <div className="mt-3 space-y-1.5 text-[11.5px] text-ink-2">
        <div>
          <span className="text-ink-3">Repro · </span> 1440×900, Chrome 121
        </div>
        <div>
          <span className="text-ink-3">Expected · </span> visible label above
          card
        </div>
        <div>
          <span className="text-ink-3">Actual · </span> only background tint
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-rule pt-3">
        {[
          "design",
          "copy",
          "p2",
        ].map((t) => (
          <span
            key={t}
            className="rounded-full border border-rule px-2 py-0.5 font-mono text-[10px] text-ink-2"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
