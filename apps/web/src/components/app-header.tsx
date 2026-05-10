interface AppHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppHeader({ title, eyebrow, subtitle, children }: AppHeaderProps) {
  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-3">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-[1.75rem]">{title}</h1>
          {subtitle ? (
            <p className="max-w-[58ch] text-[0.8125rem] leading-relaxed text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
      <div className="mt-4 h-px bg-rule sm:mt-5" />
    </header>
  );
}
