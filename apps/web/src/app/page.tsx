import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CheckCircle2,
  CircleDot,
  Crosshair,
  MessageSquare,
  MousePointer2,
  PanelRight,
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

type LandingNavItem = { href: string; label: string };
type LoopStep = { title: string; body: string };
type LandingHero = { proof: string[] };
type ContextItem = { label: string; value: string; body: string };
type AudienceItem = { label: string; body: string };

const loopIcons = [MousePointer2, MessageSquare, PanelRight] as const;

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
            <div className="hidden min-w-0 shrink-0 items-center justify-end sm:flex">
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
            <div className="shell min-w-0 py-[clamp(3.5rem,7vw,7.5rem)]">
              <div className="mx-auto max-w-4xl text-center relative z-10 grid min-w-0 gap-[var(--space-xl)] px-4">
                <div className="flex flex-col items-center gap-[var(--space-lg)]">
                  <p className="text-eyebrow">{t("hero.eyebrow")}</p>
                  <h1 className="text-editorial-hero text-ink text-center max-w-[20ch]">
                    {t("hero.title")}
                  </h1>
                  <p className="mx-auto w-full min-w-0 max-w-[55ch] text-pretty text-ui-lg leading-relaxed text-ink-2 text-center">
                    {t("hero.subtitle")}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <LandingPrimaryButton href="/signup">
                    {t("hero.chromeCta")}
                  </LandingPrimaryButton>
                  <SecondaryCtaButton href="#loop">
                    {t("hero.secondaryCta")}
                  </SecondaryCtaButton>
                </div>

                <ul
                  className="flex flex-wrap items-center justify-center gap-3 text-ink-3 text-ui-xs leading-snug"
                  aria-label={t("hero.proofLabel")}
                >
                  {heroProof.map((item) => (
                    <li key={item} className="inline-flex min-h-[1.625rem] items-center gap-2 border border-rule rounded-md bg-paper-elevated/78 px-2 py-0.5">
                      <CheckCircle2 className="size-3.5 shrink-0 text-mark" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
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
            <div className="landing-section-head mb-0 max-w-4xl">
              <p className="text-eyebrow">{t("problem.eyebrow")}</p>
              <h2 className="text-editorial-md text-balance text-ink">
                {t("problem.title")}
              </h2>
              <p className="mt-4 max-w-[64ch] text-pretty text-ui-lg leading-relaxed text-ink-2">
                {t("problem.p1")}
              </p>
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
                  {contextItems.map((item) => (
                    <div
                      key={item.label}
                      className="grid gap-2 px-4 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5 sm:px-5"
                    >
                      <dt className="font-mono text-ui-xs uppercase text-ink-3">
                        {item.label}
                      </dt>
                      <dd className="min-w-0">
                        <p className="font-display text-title-sm text-ink">
                          {item.value}
                        </p>
                        <p className="mt-1 text-pretty text-ui-sm leading-relaxed text-ink-2">
                          {item.body}
                        </p>
                      </dd>
                    </div>
                  ))}
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
              <div className="grid gap-3 sm:grid-cols-3">
                {audienceItems.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-lg border border-rule bg-paper-elevated p-4"
                  >
                    <Crosshair className="mb-5 size-4 text-mark" aria-hidden />
                    <h3 className="font-display text-title-sm text-ink">
                      {item.label}
                    </h3>
                    <p className="mt-3 text-pretty text-ui-sm leading-relaxed text-ink-2">
                      {item.body}
                    </p>
                  </article>
                ))}
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
                  <div className="grid gap-1 py-3">
                    <dt className="text-ink-3">{t("install.onboardingLabel")}</dt>
                    <dd className="font-medium text-ink">
                      {t("install.onboardingValue")}
                    </dd>
                  </div>
                  <div className="grid gap-1 py-3">
                    <dt className="text-ink-3">{t("install.tabsLabel")}</dt>
                    <dd className="font-medium text-ink">{t("install.tabsValue")}</dd>
                  </div>
                  <div className="grid gap-1 py-3">
                    <dt className="text-ink-3">{t("install.connectorsLabel")}</dt>
                    <dd className="font-medium text-ink">
                      {t("install.connectorsValue")}
                    </dd>
                  </div>
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
