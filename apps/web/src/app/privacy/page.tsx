import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy policy",
  description:
    "How youin collects, uses, and protects account, workspace, and Chrome extension data.",
};

const SUPPORT_EMAIL = "support@youin.click";
const EFFECTIVE_DATE = "July 9, 2026";

export default function PrivacyPage() {
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
          <p className="text-eyebrow mb-2">Privacy</p>
          <h1 className="text-editorial-md text-ink">Privacy policy.</h1>
          <p className="mt-4 max-w-[60ch] text-ui-lg leading-relaxed text-ink-2">
            youin is a visual feedback workspace for websites and product teams.
            This policy explains what we collect through the dashboard, Chrome
            extension, review links, and related services, and how we use it to
            provide the product.
          </p>

          <div className="mt-8 rounded-xl border border-rule bg-paper-2 p-6">
            <p className="text-eyebrow mb-3">Questions or requests</p>
            <p className="text-ui-lg leading-relaxed text-ink-2">
              Email us to request access, export, correction, deletion, a data
              processing addendum, or the current sub-processor list.
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
                Data we collect
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>
                  Account data such as name, email address, authentication
                  provider, workspace membership, and workspace settings.
                </li>
                <li>
                  Workspace content such as marks, comments, project names,
                  labels, statuses, mentions, attachments, and audit activity.
                </li>
                <li>
                  Chrome extension capture data such as page URL, page title,
                  element selector, sanitized DOM context, viewport metadata,
                  browser metadata, and screenshots when screenshot capture is
                  enabled.
                </li>
                <li>
                  Local extension data such as auth session state, sync queues,
                  selected project, widget preferences, disabled domains, and
                  unsynced marks stored in Chrome storage.
                </li>
                <li>
                  Operational data such as request logs, device and browser
                  information, error details, abuse-prevention signals, and
                  support messages you send us.
                </li>
                <li>
                  Billing records for paid plans when applicable. We do not
                  store full payment card numbers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                How we use data
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>
                  Provide, sync, search, and display visual feedback across the
                  extension and dashboard.
                </li>
                <li>
                  Authenticate users, enforce workspace access controls, and
                  protect accounts.
                </li>
                <li>
                  Store screenshots and mark context so collaborators can
                  understand the page state attached to feedback.
                </li>
                <li>
                  Maintain reliability, debug issues, prevent abuse, answer
                  support requests, and comply with legal obligations.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Sharing and processors
              </h2>
              <p className="mt-2">
                We share data only as needed to provide and operate youin: with
                members of the workspace where the data was created, with
                service providers that host, store, authenticate, secure,
                deliver, or support the product, with a payment processor for
                paid plans, and when required by law or to protect users and the
                service. Our core application infrastructure uses Supabase for
                authentication, database, and file storage.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Chrome extension data
              </h2>
              <p className="mt-2">
                The Chrome extension collects browsing activity only when it is
                needed for the user-facing review workflow, such as creating a
                mark, showing page-level feedback, syncing workspace context, or
                restoring a saved mark. The extension does not sell, transfer,
                or use browsing activity for advertising, credit, or unrelated
                profiling. The use of information collected by the Youin Chrome
                extension complies with the Chrome Web Store User Data Policy,
                including the Limited Use requirements.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                What we do not do
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>
                  We don&rsquo;t sell your data, marks, or screenshots to third
                  parties.
                </li>
                <li>
                  We don&rsquo;t use customer content to train third-party
                  models.
                </li>
                <li>
                  We don&rsquo;t inject ads, affiliate links, or tracking pixels
                  into the pages you review.
                </li>
                <li>
                  We don&rsquo;t track visitors of the pages you mark; we
                  process data from people using youin.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Retention and controls
              </h2>
              <p className="mt-2">
                Workspace content is retained until it is deleted by a user or
                workspace admin, or until the workspace is closed. Local
                extension data remains in Chrome storage until it syncs, you
                clear it, or the extension is removed. Account deletion removes
                or anonymizes personal data within 30 days unless we must keep
                limited records for security, legal, billing, or
                abuse-prevention reasons. In the extension, you can disable
                screenshots, disable DOM context capture, or disable youin on
                specific domains.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Security
              </h2>
              <p className="mt-2">
                We use HTTPS in transit, authenticated access, workspace-level
                authorization, database access controls, and storage policies
                designed to keep workspace data available only to authorized
                users. No system is perfectly secure, so please report suspected
                security issues to{" "}
                <span className="font-medium text-ink">{SUPPORT_EMAIL}</span>.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">
                Effective date
              </h2>
              <p className="mt-2">
                Effective {EFFECTIVE_DATE}. We may update this policy as the
                product changes. If a change materially affects your rights or
                how we handle user data, we will provide notice through the
                product, by email, or both.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
