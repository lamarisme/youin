interface AppHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppHeader({ title, eyebrow, subtitle, children }: AppHeaderProps) {
  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="space-y-0.5">
          {eyebrow ? (
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-3">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-lg font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 max-w-[58ch] text-[0.8125rem] leading-snug text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
      <div className="mt-2 h-px bg-rule sm:mt-2.5" />
    </header>
  );
}
