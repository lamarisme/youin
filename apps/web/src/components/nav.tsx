import Link from "next/link";

export function Nav() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="pin-dot !h-7 !w-7 !text-[0.78rem]">P</span>
          <span className="font-display text-[1.35rem] font-semibold tracking-tight">
            Pin
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-ink-2 md:flex">
          <a href="#loop" className="hover:text-ink transition-colors">
            How it works
          </a>
          <a href="#who" className="hover:text-ink transition-colors">
            Who it&rsquo;s for
          </a>
          <a href="#vs" className="hover:text-ink transition-colors">
            Comparisons
          </a>
          <a href="#pricing" className="hover:text-ink transition-colors">
            Pricing
          </a>
        </nav>

        <a
          href="#install"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink-2 transition-colors"
        >
          Add to Chrome
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </a>
      </div>
      <div className="rule mx-auto max-w-[1400px]" />
    </header>
  );
}
