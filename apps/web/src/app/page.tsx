import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BadgeCheck,
  Briefcase,
  Camera,
  CircleDot,
  CreditCard,
  Crosshair,
  FolderKanban,
  Globe2,
  Layers,
  ListTodo,
  MessageSquare,
  MousePointer2,
  Pin,
  Puzzle,
  ScanLine,
  Sparkles,
  Terminal,
  TicketCheck,
  Timer,
} from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import {
  LandingPrimaryButton,
  SecondaryCtaButton,
} from "@/components/landing-buttons";
import {
  LandingAuthProvider,
  LandingHeaderAuth,
  LandingMobileSignIn,
} from "@/components/landing-header-auth";
import { LandingProductPreview } from "@/components/landing-product-preview";

type LandingNavItem = { href: string; label: string };
type LoopStep = { title: string; body: string };
type LandingHero = { proof: string[] };
type ContextItem = { label: string; value: string; body: string };
type AudienceItem = { label: string; body: string };

const loopIcons = [Pin, Layers, ListTodo] as const;
const proofIcons = [BadgeCheck, Puzzle, CreditCard, Globe2] as const;
const contextIcons = [MousePointer2, Camera, MessageSquare, FolderKanban] as const;
const audienceIcons = [Briefcase, Sparkles, Terminal] as const;
const installIcons = [Timer, FolderKanban, ScanLine] as const;

export default async function Home() {
  const t = await getTranslations("landing");
  const messages = (await import("@youin/i18n/messages/en.json")).default;
  const landing = messages.landing as {
    nav: LandingNavItem[];
    hero: LandingHero;
    loop: { steps: LoopStep[] };
    context: { items: ContextItem[] };
    audience: { items: AudienceItem[] };
  };

  const navItems = landing.nav;
  const heroProof = landing.hero.proof;
  const loopSteps = landing.loop.steps;
  const contextItems = landing.context.items;
  const audienceItems = landing.audience.items;

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper bg-paper-grain text-ink">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-mark focus-visible:px-3 focus-visible:py-2 focus-visible:text-ui-sm focus-visible:font-medium focus-visible:text-paper"
      >
        {t("skipLink")}
      </a>
      <LandingAuthProvider>
        <header className="sticky top-0 z-30 border-b border-rule bg-paper/95">
          <div className="shell flex min-h-14 items-center justify-between gap-3 py-2">
            <Link
              href="/"
              aria-label="youin home"
              className="flex h-10 shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <BrandLockup />
            </Link>
            <nav
              aria-label="Primary"
              className="hidden min-w-0 items-center gap-4 text-ui-sm font-medium text-ink-2 md:flex lg:gap-5"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="-mx-2 inline-flex h-9 max-w-[12rem] items-center truncate px-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="hidden min-w-0 shrink-0 items-center justify-end md:flex">
              <LandingHeaderAuth />
            </div>
          </div>
          <div className="shell pb-3 md:hidden">
            <nav
              aria-label="Mobile navigation"
              className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 max-w-[14rem] shrink-0 items-center truncate rounded-md border border-rule px-3 text-ui-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {item.label}
                </a>
              ))}
              <LandingMobileSignIn />
            </nav>
          </div>
        </header>

        <main id="main" className="section-stack pb-[var(--page-y-loose)]">
          <section className="section-reveal">
            <div className="shell min-w-0 py-[clamp(3.5rem,7vw,6.5rem)]">
              <div className="relative z-10 grid min-w-0 gap-[clamp(2rem,4vw,3.5rem)] lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.72fr)] lg:items-end">
                <div className="flex min-w-0 flex-col items-start gap-[var(--space-lg)]">
                  <p className="text-eyebrow">{t("hero.eyebrow")}</p>
                  <h1 className="max-w-[11ch] font-display text-[clamp(3.25rem,7.2vw,6.5rem)] font-semibold leading-[0.9] text-balance text-ink">
                    {t("hero.title")}
                  </h1>
                </div>

                <div className="min-w-0 border-t border-rule pt-5 lg:mb-1">
                  <p className="max-w-[56ch] text-pretty text-ui-lg leading-relaxed text-ink-2">
                    {t("hero.subtitle")}
                  </p>
                  <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row">
                    <LandingPrimaryButton href="/signup">
                      {t("hero.chromeCta")}
                    </LandingPrimaryButton>
                    <SecondaryCtaButton href="#loop">
                      {t("hero.secondaryCta")}
                    </SecondaryCtaButton>
                  </div>
                  <ul
                    className="mt-6 grid gap-x-4 gap-y-2 text-ui-xs text-ink-3 sm:grid-cols-2"
                    aria-label={t("hero.proofLabel")}
                  >
                    {heroProof.map((item, index) => {
                      const Icon = proofIcons[index] ?? BadgeCheck;
                      return (
                        <li key={item} className="flex min-w-0 items-center gap-2">
                          <Icon className="size-3.5 shrink-0 text-mark" aria-hidden />
                          <span>{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="mt-[clamp(2.75rem,6vw,5rem)]">
                <LandingProductPreview />
              </div>
            </div>
          </section>

          <section id="loop" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="grid gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-start">
              <div className="landing-section-head mb-0">
                <p className="text-eyebrow">{t("loop.eyebrow")}</p>
                <h2 className="text-editorial-md text-balance text-ink">
                  {t("loop.title")}
                </h2>
              </div>

              <div className="divide-y divide-rule border-y border-rule">
                {loopSteps.map((step, index) => {
                  const Icon = loopIcons[index] ?? CircleDot;

                  return (
                    <article
                      key={step.title}
                      className="grid gap-4 py-[clamp(1.35rem,3vw,2.25rem)] sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-5"
                    >
                      <div className="flex items-center gap-2 sm:block">
                        <span className="inline-flex size-9 items-center justify-center rounded-md border border-rule bg-paper-elevated text-mark">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <p className="font-mono text-ui-xs text-ink-3 sm:mt-3">
                          {String(index + 1).padStart(2, "0")}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-title-sm text-balance text-ink">
                          {step.title}
                        </h3>
                        <p className="mt-3 max-w-[62ch] text-pretty text-ui-sm leading-relaxed text-ink-2">
                          {step.body}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="problem" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="grid gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
              <div className="landing-section-head mb-0 max-w-4xl">
                <p className="text-eyebrow">{t("problem.eyebrow")}</p>
                <h2 className="text-editorial-md text-balance text-ink">
                  {t("problem.title")}
                </h2>
                <p className="mt-4 max-w-[64ch] text-pretty text-ui-lg leading-relaxed text-ink-2">
                  {t("problem.p1")}
                </p>
              </div>

              <div className="grid overflow-hidden rounded-lg border border-rule bg-paper-elevated sm:grid-cols-2">
                <div className="border-b border-rule p-4 sm:border-b-0 sm:border-r sm:p-5">
                  <p className="font-mono text-ui-2xs uppercase tracking-[0.1em] text-ink-3">
                    The old handoff
                  </p>
                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                    {[Camera, MessageSquare, TicketCheck].map((Icon, index) => (
                      <div key={index} className="contents">
                        <div className="grid min-w-0 place-items-center gap-2 text-center">
                          <Icon className="size-4 text-ink-3" aria-hidden />
                          <span className="text-ui-2xs text-ink-2">
                            {index === 0
                              ? "Screenshot"
                              : index === 1
                                ? "Chat thread"
                                : "Flat ticket"}
                          </span>
                        </div>
                        {index < 2 ? (
                          <span className="font-mono text-ui-xs text-ink-3">
                            →
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-mark-soft text-mark">
                      <Pin className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="font-mono text-ui-2xs uppercase tracking-[0.1em] text-mark">
                        The YouIn handoff
                      </p>
                      <p className="mt-2 font-display text-title-sm text-ink">
                        One mark keeps the whole scene attached.
                      </p>
                      <p className="mt-2 text-ui-xs leading-relaxed text-ink-2">
                        Element, evidence, discussion, and status travel together.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            id="context"
            className="scroll-mt-32 border-y border-rule bg-paper-2 py-[var(--page-y-loose)] md:scroll-mt-20"
          >
            <div className="shell grid gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
              <div className="landing-section-head mb-0">
                <p className="text-eyebrow">{t("context.eyebrow")}</p>
                <h2 className="text-editorial-md text-balance text-ink">
                  {t("context.title")}
                </h2>
                <p className="max-w-[52ch] text-pretty text-ui-lg leading-relaxed text-ink-2">
                  {t("context.subtitle")}
                </p>
              </div>

              <div className="rounded-lg border border-rule bg-paper-elevated">
                <dl className="divide-y divide-rule">
                  {contextItems.map((item, index) => {
                    const Icon = contextIcons[index] ?? Crosshair;
                    return (
                      <div
                        key={item.label}
                        className="grid gap-3 px-4 py-4 sm:grid-cols-[2rem_7.5rem_minmax(0,1fr)] sm:items-start sm:gap-4 sm:px-5"
                      >
                        <span className="inline-flex size-8 items-center justify-center rounded-md border border-rule bg-paper-2 text-mark">
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <dt className="font-mono text-ui-xs uppercase text-ink-3 sm:pt-2">
                          {item.label}
                        </dt>
                        <dd className="min-w-0 sm:pt-1">
                          <p className="font-display text-title-sm text-ink">
                            {item.value}
                          </p>
                          <p className="mt-1 text-pretty text-ui-sm leading-relaxed text-ink-2">
                            {item.body}
                          </p>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            </div>
          </section>

          <section className="shell">
            <div className="grid gap-[var(--space-xl)] lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start">
              <div>
                <p className="text-eyebrow">{t("audience.eyebrow")}</p>
                <h2 className="mt-3 max-w-[9ch] font-display text-[clamp(2.25rem,6vw,5rem)] font-semibold leading-[0.95] text-balance text-ink">
                  {t("audience.title")}
                </h2>
              </div>
              <div className="grid overflow-hidden rounded-lg border border-rule bg-paper-elevated sm:grid-cols-3 sm:divide-x sm:divide-rule">
                {audienceItems.map((item, index) => {
                  const Icon = audienceIcons[index] ?? Crosshair;
                  return (
                    <article
                      key={item.label}
                      className="border-b border-rule p-5 last:border-b-0 sm:border-b-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 text-mark" aria-hidden />
                        <h3 className="font-display text-title-sm text-ink">
                          {item.label}
                        </h3>
                      </div>
                      <p className="mt-3 text-pretty text-ui-sm leading-relaxed text-ink-2">
                        {item.body}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            id="install"
            className="shell scroll-mt-32 md:scroll-mt-20"
          >
            <div className="relative overflow-hidden rounded-lg border border-rule bg-paper-elevated px-4 py-[clamp(2.5rem,5vw,4.5rem)] text-ink sm:px-6 lg:px-10">
              <div className="grid gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)] lg:items-end">
                <div className="min-w-0">
                  <p className="text-eyebrow text-ink-3">
                    {t("install.eyebrow")}
                  </p>
                  <h2 className="mt-4 max-w-[12ch] font-display text-[clamp(2.5rem,6vw,5.75rem)] font-semibold leading-[0.94] text-balance text-ink">
                    {t("install.title")}
                  </h2>
                  <p className="mt-5 max-w-[54ch] text-pretty text-ui-lg leading-relaxed text-ink-2">
                    {t("install.subtitle")}
                  </p>
                  <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
                    <LandingPrimaryButton href="/signup">
                      {t("install.chromeCta")}
                    </LandingPrimaryButton>
                    <SecondaryCtaButton href="/contact">
                      {t("install.contactCta")}
                    </SecondaryCtaButton>
                  </div>
                </div>

                <dl className="divide-y divide-rule border-y border-rule text-ui-sm">
                  {[
                    [t("install.onboardingLabel"), t("install.onboardingValue")],
                    [t("install.tabsLabel"), t("install.tabsValue")],
                    [t("install.connectorsLabel"), t("install.connectorsValue")],
                  ].map(([label, value], index) => {
                    const Icon = installIcons[index] ?? CircleDot;
                    return (
                      <div
                        key={label}
                        className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3.5"
                      >
                        <Icon className="mt-0.5 size-4 text-mark" aria-hidden />
                        <div className="grid gap-1">
                          <dt className="text-ink-3">{label}</dt>
                          <dd className="font-medium text-ink">{value}</dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-rule bg-paper py-6">
          <div className="shell flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 font-mono text-ui-xs text-ink-3">
              {t("footer.copyright")}
            </p>
            <div className="-my-1.5 flex flex-wrap gap-1 text-ui-xs text-ink-3">
              <Link
                href="/terms"
                className="inline-flex min-h-11 items-center px-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {t("footer.terms")}
              </Link>
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center px-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {t("footer.privacy")}
              </Link>
            </div>
          </div>
        </footer>
      </LandingAuthProvider>
    </div>
  );
}
