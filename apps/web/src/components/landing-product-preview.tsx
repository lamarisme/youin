import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Globe2,
  Link2,
  MessageSquare,
  Monitor,
  MousePointer2,
  ScanLine,
} from "lucide-react";

import { MarkPin } from "@/components/mark-pin";

const contextRows = [
  { icon: Link2, label: "Page", value: "/pricing" },
  { icon: ScanLine, label: "Element", value: "button.secondary" },
  { icon: Monitor, label: "Viewport", value: "1440 × 900" },
  { icon: Camera, label: "Capture", value: "Screenshot saved" },
] as const;

export function LandingProductPreview() {
  return (
    <figure
      className="relative overflow-hidden rounded-xl border border-rule bg-paper-elevated shadow-panel"
      aria-label="YouIn mark attached to a pricing page button with its task and capture context visible"
    >
      <div aria-hidden>
        <div className="flex h-11 items-center gap-3 border-b border-rule bg-paper-2 px-3 sm:px-4">
          <div className="hidden items-center gap-1.5 sm:flex">
            <Circle className="size-2.5 fill-ink-3/35 text-transparent" />
            <Circle className="size-2.5 fill-ink-3/25 text-transparent" />
            <Circle className="size-2.5 fill-ink-3/15 text-transparent" />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-rule bg-paper px-3 py-1.5 font-mono text-ui-2xs text-ink-3 sm:max-w-md">
            <Globe2 className="size-3 shrink-0" />
            <span className="truncate">yourproduct.com/pricing</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-ui-2xs text-ink-3">
            <span className="size-1.5 rounded-full bg-ok" />
            <span className="hidden sm:inline">Reviewing live</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="relative min-h-[27rem] overflow-hidden bg-paper">
            <div className="flex h-12 items-center justify-between border-b border-rule px-4 sm:px-6">
              <div className="flex items-center gap-2 font-display text-ui-sm font-semibold text-ink">
                <span className="grid size-5 place-items-center rounded-sm bg-ink text-[0.6rem] font-bold text-paper">
                  AC
                </span>
                Acme
              </div>
              <div className="hidden items-center gap-5 text-ui-xs text-ink-3 sm:flex">
                <span>Product</span>
                <span>Pricing</span>
                <span>Company</span>
                <span className="rounded-md bg-ink px-3 py-1.5 font-medium text-paper">
                  Get started
                </span>
              </div>
            </div>

            <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
              <p className="font-mono text-ui-2xs uppercase tracking-[0.12em] text-ink-3">
                Simple pricing
              </p>
              <h3 className="mt-3 max-w-[12ch] font-display text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-[1] text-ink">
                One plan. Everything you need to ship.
              </h3>
              <p className="mt-4 max-w-[48ch] text-ui-sm leading-relaxed text-ink-2">
                Collaborate with your whole team and keep every project moving.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-rule bg-paper-elevated p-4 sm:p-5">
                  <p className="font-mono text-ui-2xs uppercase text-ink-3">
                    Starter
                  </p>
                  <p className="mt-2 font-display text-title-md text-ink">$12</p>
                  <div className="mt-4 h-2 w-4/5 rounded-full bg-paper-3" />
                  <div className="mt-2 h-2 w-3/5 rounded-full bg-paper-3" />
                  <div className="mt-5 h-9 rounded-md border border-rule bg-paper-2" />
                </div>

                <div className="relative rounded-lg border border-rule-strong bg-paper-elevated p-4 sm:p-5">
                  <MarkPin
                    label="1"
                    size="lg"
                    pulse
                    className="absolute -right-2.5 -top-2.5"
                  />
                  <p className="font-mono text-ui-2xs uppercase text-ink-3">
                    Team
                  </p>
                  <p className="mt-2 font-display text-title-md text-ink">$29</p>
                  <div className="mt-4 h-2 w-4/5 rounded-full bg-paper-3" />
                  <div className="mt-2 h-2 w-2/3 rounded-full bg-paper-3" />
                  <div className="relative mt-5 flex h-9 items-center justify-center rounded-md border border-mark bg-mark-soft font-medium text-ui-xs text-mark">
                    Start free trial
                    <span className="absolute inset-[-5px] rounded-[0.55rem] border border-dashed border-mark/70" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-rule bg-paper-elevated px-2.5 py-2 shadow-popover sm:bottom-5 sm:left-5">
              <MousePointer2 className="size-3.5 text-mark" />
              <span className="text-ui-xs font-medium text-ink">Element selected</span>
            </div>
          </div>

          <aside className="border-t border-rule bg-paper-2 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-rule px-4 py-3">
              <div>
                <p className="font-mono text-ui-2xs text-ink-3">MARK UI-128</p>
                <p className="mt-1 text-ui-xs font-medium text-ink">Pricing page</p>
              </div>
              <ChevronDown className="size-4 text-ink-3" />
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-2 py-1 text-ui-2xs font-medium text-ink-2">
                  <Clock3 className="size-3 text-mark" />
                  In review
                </span>
                <span className="text-ui-2xs text-ink-3">High priority</span>
              </div>

              <h4 className="mt-4 font-display text-title-sm text-ink">
                Increase contrast on the secondary CTA
              </h4>
              <p className="mt-2 text-ui-xs leading-relaxed text-ink-2">
                This disappears against the card on lower-contrast displays.
              </p>

              <div className="mt-5 divide-y divide-rule border-y border-rule">
                {contextRows.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="grid grid-cols-[1rem_4.25rem_minmax(0,1fr)] items-center gap-2 py-2.5"
                  >
                    <Icon className="size-3.5 text-ink-3" />
                    <span className="text-ui-2xs text-ink-3">{label}</span>
                    <span className="truncate text-right font-mono text-ui-2xs text-ink-2">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-md border border-rule bg-paper p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-paper-3 text-[0.55rem] font-semibold text-ink-2">
                    LM
                  </span>
                  <span className="text-ui-2xs font-medium text-ink">Lamar</span>
                  <span className="ml-auto text-ui-2xs text-ink-3">now</span>
                </div>
                <p className="mt-2 text-ui-xs leading-relaxed text-ink-2">
                  Good catch. I&apos;ll update the token and verify it here.
                </p>
                <div className="mt-3 flex items-center justify-between text-ui-2xs text-ink-3">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3" /> 2 replies
                  </span>
                  <CheckCircle2 className="size-3.5 text-ok" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </figure>
  );
}
