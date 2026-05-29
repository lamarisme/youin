import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy policy",
  description: "How youin handles the data captured by marks, comments, and integrations.",
};

const SUPPORT_EMAIL = "support@youin.click";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule">
        <div className="shell flex h-14 items-center justify-between">
          <Link href="/" aria-label="youin home" className="flex h-10 items-center">
            <BrandLockup />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-ui-sm text-ink-2 hover:text-ink"
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
            youin captures element selectors, sanitized DOM context, viewport metadata, and
            screenshots of the live pages you mark. The full policy — what we store, where, for how
            long, and who can request a copy or deletion — is being finalized ahead of general
            availability.
          </p>

          <div className="mt-8 rounded-xl border border-rule bg-paper-2 p-6">
            <p className="text-eyebrow mb-3">Need the current version?</p>
            <p className="text-ui-lg leading-relaxed text-ink-2">
              Email us for the latest draft, including the sub-processor list and the data
              processing addendum.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="h-11 px-5 text-ui-md font-semibold">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2">
                  <Mail className="size-4" />
                  {SUPPORT_EMAIL}
                </a>
              </Button>
              <Button variant="outline" asChild className="h-11 px-5 text-ui-md">
                <Link href="/contact">Contact form</Link>
              </Button>
            </div>
          </div>

          <div className="mt-10 space-y-6 text-ui-lg leading-relaxed text-ink-2">
            <section>
              <h2 className="font-display text-xl font-semibold text-ink">What we capture</h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>Element selector, sanitized DOM context, viewport size, browser, and a screenshot of the marked area.</li>
                <li>Page URL and title at the moment a mark is created.</li>
                <li>Comments and their authors within your workspace.</li>
                <li>Account info: email, workspace name, and billing details for paid plans.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">What we don&rsquo;t do</h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>We don&rsquo;t sell your data, marks, or screenshots to third parties.</li>
                <li>We don&rsquo;t use customer content to train third-party models.</li>
                <li>We don&rsquo;t track visitors of the pages you mark — only the people you invite to your workspace.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">Your controls</h2>
              <p className="mt-2">
                Workspace admins can export or delete marks at any time. Account deletion removes
                your authored content within 30 days. Email <span className="font-medium text-ink">{SUPPORT_EMAIL}</span> for
                a copy of your data or a deletion request.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">Effective date</h2>
              <p className="mt-2">
                Pending publication. We&rsquo;ll notify customers in advance of any material change
                once the final version is posted.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
