import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Kept as a safe landing page for bookmarks and older extension builds.
 * Authentication now completes inside Chrome Identity using an
 * extension-bound chromiumapp.org redirect, so this page never reads or
 * forwards a browser session.
 */
export default function ExtensionBridgePage() {
  return (
    <div className="surface-elevated mx-auto w-full max-w-[calc(100vw-2rem)] rounded-lg p-6 sm:p-7">
      <h2 className="font-display text-xl font-semibold text-ink">
        Connect from the extension
      </h2>
      <p className="mt-1 text-ui-sm text-ink-2">
        This legacy connection page no longer sends session tokens to browser
        extensions. Open the YouIn extension and choose Continue with Google.
      </p>
      <Button asChild className="mt-5 h-10 w-full">
        <Link href="/dashboard">Open YouIn</Link>
      </Button>
    </div>
  );
}
