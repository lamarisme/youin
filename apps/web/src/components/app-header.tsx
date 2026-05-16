interface AppHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppHeader({ title, eyebrow, subtitle, children }: AppHeaderProps) {
  return (
    <header className="min-h-10 pb-1">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="space-y-0.5">
          {eyebrow ? (
            <p className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-3">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[0.9375rem] font-medium leading-tight text-ink">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 max-w-[58ch] text-[0.75rem] leading-snug text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        {children ? <div className="flex min-h-8 shrink-0 items-center gap-1.5">{children}</div> : null}
      </div>
    </header>
  );
}
