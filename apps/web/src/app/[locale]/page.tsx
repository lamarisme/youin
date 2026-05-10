import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChromeCtaButton,
  SecondaryCtaButton,
} from "@/components/landing-buttons";
import {
  LandingHeaderAuth,
  LandingMobileSignIn,
} from "@/components/landing-header-auth";
import { FadeIn } from "@/components/motion";
import { Link } from "@/i18n/navigation";

type LandingNavItem = { href: string; label: string };
type LoopStep = { num: string; title: string; body: string };
type Persona = { role: string; detail: string; body: string };
type PricingTier = {
  name: string;
  price: string;
  period: string;
  blurb: string;
  cta: string;
  href: string;
  highlighted?: boolean;
  features: string[];
};

export default async function Home() {
  const t = await getTranslations("landing");
  const messages = (await import("@youin/i18n/messages/en.json")).default;
  const landing = messages.landing as {
    nav: LandingNavItem[];
    loop: { steps: LoopStep[] };
    who: { personas: Persona[] };
    pricing: { tiers: PricingTier[]; popular: string };
  };

  const navItems = landing.nav;
  const loopSteps = landing.loop.steps;
  const personas = landing.who.personas;
  const tiers = landing.pricing.tiers;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-ink focus-visible:px-3 focus-visible:py-2 focus-visible:text-[0.8125rem] focus-visible:font-medium focus-visible:text-paper"
      >
        {t("skipLink")}
      </a>
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="shell flex items-center justify-between py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="pin-dot">Y</span>
            <span className="font-display text-lg font-semibold">youin</span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-5 text-[0.8125rem] text-ink-2 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="-my-1.5 inline-flex items-center py-1.5 transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LandingHeaderAuth />
          </div>
        </div>
        <div className="shell pb-3 md:hidden">
          <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-rule px-3 text-[0.8125rem] text-ink-2"
              >
                {item.label}
              </a>
            ))}
            <LandingMobileSignIn />
          </nav>
        </div>
      </header>

      <main id="main" className="section-stack page-y-loose">
        <FadeIn>
          <section className="shell">
            <h1 className="text-editorial text-ink">{t("hero.title")}</h1>
            <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-ink-2">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ChromeCtaButton href="#install">{t("hero.chromeCta")}</ChromeCtaButton>
              <SecondaryCtaButton href="#loop">{t("hero.secondaryCta")}</SecondaryCtaButton>
            </div>
            <p className="mt-5 font-mono text-[0.6875rem] text-ink-3">{t("hero.metaLine")}</p>
          </section>
        </FadeIn>

        <FadeIn>
          <section id="problem" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:gap-12">
              <div>
                <h2 className="text-editorial-md text-ink">{t("problem.title")}</h2>
              </div>
              <div className="space-y-4">
                <p className="text-[0.9375rem] leading-relaxed text-ink-2">{t("problem.p1")}</p>
                <div className="rounded-lg bg-paper-2 px-4 py-3">
                  <p className="text-eyebrow mb-2">{t("problem.oldLoopLabel")}</p>
                  <p className="text-[0.8125rem] leading-relaxed text-ink-3">{t("problem.oldLoopBody")}</p>
                </div>
                <div className="rounded-lg bg-mark-soft px-4 py-3">
                  <p className="text-eyebrow mb-2">{t("problem.withLabel")}</p>
                  <p className="text-[0.8125rem] font-medium leading-relaxed text-ink">{t("problem.withBody")}</p>
                </div>
              </div>
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section id="loop" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="mb-10">
              <p className="text-eyebrow mb-2">{t("loop.eyebrow")}</p>
              <h2 className="text-editorial-md text-ink">{t("loop.title")}</h2>
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
        </FadeIn>

        <FadeIn>
          <section id="who" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="mb-10">
              <p className="text-eyebrow mb-2">{t("who.eyebrow")}</p>
              <h2 className="text-editorial-md text-ink">{t("who.title")}</h2>
            </div>

            <div className="divide-y divide-rule border-y border-rule">
              {personas.map((p) => (
                <div
                  key={p.role}
                  className="grid gap-1 py-6 md:grid-cols-[180px_220px_1fr] md:items-baseline md:gap-10"
                >
                  <p className="text-eyebrow">{p.detail}</p>
                  <h3 className="font-display text-xl font-semibold text-ink">{p.role}</h3>
                  <p className="max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-2">{p.body}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section id="pricing" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="mb-10">
              <p className="text-eyebrow mb-2">{t("pricing.eyebrow")}</p>
              <h2 className="text-editorial-md text-ink">{t("pricing.title")}</h2>
              <p className="mt-4 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-2">{t("pricing.subtitle")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex flex-col gap-5 rounded-xl border p-6 ${
                    tier.highlighted ? "border-mark bg-mark-soft" : "border-rule bg-paper-2"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold text-ink">{tier.name}</h3>
                      {tier.highlighted ? (
                        <Badge className="bg-mark text-paper text-[0.625rem]">{t("pricing.popular")}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[0.8125rem] text-ink-2">{tier.blurb}</p>
                  </div>
                  <p className="font-display text-3xl font-semibold tracking-tight text-ink">
                    {tier.price}
                    <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-3">{tier.period}</span>
                  </p>
                  <ul className="flex-1 space-y-2 text-[0.8125rem] text-ink-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="mt-1 size-1 shrink-0 rounded-full bg-mark" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant={tier.highlighted ? "default" : "outline"} className="w-full" asChild>
                    {tier.href.startsWith("#") ? (
                      <a href={tier.href}>{tier.cta}</a>
                    ) : (
                      <Link href={tier.href}>{tier.cta}</Link>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section id="install" className="border-t border-rule bg-paper-2 scroll-mt-32 md:scroll-mt-20">
            <div className="shell page-y-loose grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
              <div>
                <h2 className="text-editorial-md text-ink">{t("install.title")}</h2>
                <p className="mt-4 max-w-[48ch] text-[0.9375rem] leading-relaxed text-ink-2">{t("install.subtitle")}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ChromeCtaButton href="#install">{t("install.chromeCta")}</ChromeCtaButton>
                  <SecondaryCtaButton href="/contact">{t("install.contactCta")}</SecondaryCtaButton>
                </div>
              </div>

              <div>
                <p className="text-eyebrow mb-4">{t("install.glanceTitle")}</p>
                <dl className="divide-y divide-rule border-y border-rule text-[0.875rem]">
                  <div className="flex items-baseline justify-between py-3">
                    <dt className="text-ink-2">{t("install.onboardingLabel")}</dt>
                    <dd className="font-medium text-ink">{t("install.onboardingValue")}</dd>
                  </div>
                  <div className="flex items-baseline justify-between py-3">
                    <dt className="text-ink-2">{t("install.tabsLabel")}</dt>
                    <dd className="font-medium text-ink">{t("install.tabsValue")}</dd>
                  </div>
                  <div className="flex items-baseline justify-between py-3">
                    <dt className="text-ink-2">{t("install.connectorsLabel")}</dt>
                    <dd className="font-medium text-ink">{t("install.connectorsValue")}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </FadeIn>
      </main>

      <footer className="border-t border-rule bg-paper py-6">
        <div className="shell flex items-center justify-between">
          <p className="font-mono text-[0.6875rem] text-ink-3">{t("footer.copyright")}</p>
          <div className="-my-1.5 flex gap-1 text-[0.75rem] text-ink-3">
            <Link href="/terms" className="inline-flex items-center px-2 py-1.5 hover:text-ink">
              {t("footer.terms")}
            </Link>
            <Link href="/privacy" className="inline-flex items-center px-2 py-1.5 hover:text-ink">
              {t("footer.privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
