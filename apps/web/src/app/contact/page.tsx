import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Contact youin",
  description: "Talk to a human about youin. We respond within one working day.",
};

const SUPPORT_EMAIL = "support@youin.dev";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule">
        <div className="shell flex items-center justify-between py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="pin-dot">Y</span>
            <span className="font-display text-lg font-semibold">youin</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Back to landing
          </Link>
        </div>
      </header>

      <main className="shell page-y-loose">
        <div className="mx-auto max-w-[640px]">
          <p className="text-eyebrow mb-2">Talk to a human</p>
          <h1 className="text-editorial-md text-ink">We answer within one working day.</h1>
          <p className="mt-4 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-2">
            Pricing questions, agency volume, custom integrations, or you just want to chat about how
            you&rsquo;d use youin in your workflow — write to us directly.
          </p>

          <div className="mt-8 rounded-xl border border-rule bg-paper-2 p-6">
            <p className="text-eyebrow mb-3">Email</p>
            <p className="font-display text-2xl font-semibold text-ink">{SUPPORT_EMAIL}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="h-11 px-5 text-[0.875rem] font-semibold">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2">
                  <Mail className="size-4" />
                  Open in mail
                </a>
              </Button>
              <Button variant="outline" asChild className="h-11 px-5 text-[0.875rem]">
                <Link href="/signup">Or start a trial</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-3 text-[0.8125rem] text-ink-2 sm:grid-cols-2">
            <div className="rounded-lg border border-rule bg-paper p-4">
              <p className="text-eyebrow mb-1.5">Sales</p>
              <p>Agency volume, multi-workspace, white-label widget.</p>
            </div>
            <div className="rounded-lg border border-rule bg-paper p-4">
              <p className="text-eyebrow mb-1.5">Support</p>
              <p>Bug reports, integration help, billing questions.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-rule bg-paper py-6">
        <div className="shell flex items-center justify-between">
          <p className="font-mono text-[0.6875rem] text-ink-3">&copy; 2026 youin</p>
          <Link href="/" className="text-[0.75rem] text-ink-3 hover:text-ink">
            Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
