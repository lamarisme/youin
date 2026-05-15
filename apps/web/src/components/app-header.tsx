interface AppHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppHeader({ title, eyebrow, subtitle, children }: AppHeaderProps) {
  return (
    <header className="border-b border-rule pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="space-y-0.5">
          {eyebrow ? (
            <p className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-3">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[0.9375rem] font-semibold leading-tight text-ink sm:text-base">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 max-w-[58ch] text-[0.75rem] leading-snug text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
      </div>
    </header>
  );
}
