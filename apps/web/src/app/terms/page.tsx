import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms",
  description: "The terms that govern your use of youin. Contact us for the current version.",
};

const SUPPORT_EMAIL = "support@youin.dev";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule">
        <div className="shell flex items-center justify-between py-3.5">
          <Link href="/" aria-label="youin home" className="flex min-h-11 items-center">
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
          <p className="text-eyebrow mb-2">Terms</p>
          <h1 className="text-editorial-md text-ink">Terms of service.</h1>
          <p className="mt-4 max-w-[60ch] text-ui-lg leading-relaxed text-ink-2">
            These terms govern your use of youin — the Chrome extension, the dashboard, the npm
            package, and any related services we provide. We&rsquo;re finalizing the full document
            ahead of general availability.
          </p>

          <div className="mt-8 rounded-xl border border-rule bg-paper-2 p-6">
            <p className="text-eyebrow mb-3">Need the current version?</p>
            <p className="text-ui-lg leading-relaxed text-ink-2">
              Email us and we&rsquo;ll send the latest draft, including the data processing
              addendum if you&rsquo;re reviewing as a customer.
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
              <h2 className="font-display text-xl font-semibold text-ink">What this will cover</h2>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>Account, billing, and trial mechanics for the Solo, Team, and Agency plans.</li>
                <li>Permitted and prohibited use of the extension and the npm package.</li>
                <li>Ownership of the marks and comments you and your collaborators create.</li>
                <li>Service availability, support response, and termination rights.</li>
                <li>Limitation of liability, governing law, and dispute resolution.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-ink">Effective date</h2>
              <p className="mt-2">
                Pending publication. Trials and paid plans are provisioned under the current draft;
                we&rsquo;ll notify customers in advance of any material change once the final
                version is posted.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
