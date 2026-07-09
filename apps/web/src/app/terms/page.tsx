import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms of service",
  description:
    "The terms that govern your use of the youin dashboard, Chrome extension, and related services.",
};

const SUPPORT_EMAIL = "support@youin.click";
const EFFECTIVE_DATE = "July 9, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule">
        <div className="shell flex h-14 items-center justify-between">
          <Link
            href="/"
            aria-label="youin home"
            className="flex h-10 items-center"
          >
            <BrandLockup />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-ui-sm text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ArrowLeft className="size-3.5" />
            Back to landing
          </Link>
        </div>
      </header>

      <main className="shell page-y-loose">
        <div className="mx-auto max-w-[640px]">
          <p className="text-eyebrow mb-2">Terms</p>
          <h1 className="text-editorial-md text-ink">Terms of service.</h1>
          <p className="mt-4 max-w-[60ch] text-ui-lg leading-relaxed text-ink-2">
            These terms govern your use of youin — the Chrome extension, the
            dashboard, the npm package, review links, and any related services
            we provide. By creating an account, joining a workspace, installing
            the extension, or using the service, you agree to these terms.
          </p>

          <div className="mt-8 rounded-xl border border-rule bg-paper-2 p-6">
            <p className="text-eyebrow mb-3">Questions</p>
            <p className="text-ui-lg leading-relaxed text-ink-2">
              Email us for contract, billing, security, or data processing
              questions.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="h-11 px-5 text-ui-md font-semibold">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex items-center gap-2"
                >
                  <Mail className="size-4" />
                  {SUPPORT_EMAIL}
                </a>
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-11 px-5 text-ui-md"
              >
                <Link href="/contact">Contact form</Link>
              </Button>
            </div>
          </div>

          <div className="mt-10 space-y-6 text-ui-lg leading-relaxed text-ink-2">
            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Accounts and workspaces
              </h2>
              <p className="mt-2">
                You are responsible for the information you provide, for keeping
                account access secure, and for the activity that occurs in
                workspaces you administer. You may only invite collaborators
                when you have the right to share the workspace content with
                them.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Permitted use
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>
                  Use youin to capture, organize, discuss, and resolve visual
                  feedback on sites and products you are authorized to review.
                </li>
                <li>
                  Install the Chrome extension and npm package only for lawful
                  product, design, development, QA, support, or client review
                  work.
                </li>
                <li>
                  Respect site owners, workspace members, and any privacy,
                  security, confidentiality, or acceptable-use obligations that
                  apply to your work.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Prohibited use
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>
                  Do not use youin to access, capture, or share content you are
                  not authorized to view or process.
                </li>
                <li>
                  Do not upload unlawful, abusive, deceptive, infringing, or
                  sensitive regulated content unless you have a lawful basis and
                  written permission from us where required.
                </li>
                <li>
                  Do not reverse engineer, disrupt, overload, bypass security
                  controls, or use the service to build malware, spyware, or
                  unauthorized tracking.
                </li>
                <li>
                  Do not use the extension to inject ads, affiliate links,
                  deceptive UI, or unrelated scripts into third-party pages.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Customer content
              </h2>
              <p className="mt-2">
                You keep ownership of the marks, screenshots, comments, page
                context, and other content you submit to youin. You grant us the
                limited rights needed to host, process, sync, display, secure,
                back up, and support that content for you and your authorized
                workspace members.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Plans and billing
              </h2>
              <p className="mt-2">
                Paid plans, trials, renewals, taxes, and cancellations are
                described at checkout or in the applicable order terms. Unless a
                written agreement says otherwise, fees are non-refundable except
                where required by law.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Availability and changes
              </h2>
              <p className="mt-2">
                We work to keep youin reliable, but the service is provided
                without a guaranteed uptime commitment unless we sign a separate
                agreement. We may update features, integrations, and these terms
                as the product evolves. Material changes will be communicated
                through the product, by email, or both.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Disclaimers and liability
              </h2>
              <p className="mt-2">
                To the maximum extent allowed by law, youin is provided as is,
                and we disclaim implied warranties of merchantability, fitness
                for a particular purpose, and non-infringement. We are not
                liable for indirect, incidental, special, consequential,
                exemplary, or punitive damages, or for lost profits, revenue,
                data, or goodwill.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Effective date
              </h2>
              <p className="mt-2">
                Effective {EFFECTIVE_DATE}. Contact{" "}
                <span className="font-medium text-ink">{SUPPORT_EMAIL}</span> if
                your organization needs a signed order form, data processing
                addendum, or custom agreement.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
