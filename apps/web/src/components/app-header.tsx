interface AppHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}

export function AppHeader({ title, subtitle, eyebrow, children }: AppHeaderProps) {
  return (
    <header className="mb-8 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-[1.75rem]">{title}</h1>
          {subtitle ? (
            <p className="max-w-[58ch] text-[0.8125rem] leading-relaxed text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        {children ? <div className="flex items-center gap-2">{children}</div> : null}
      </div>
      <div className="mt-6 h-px bg-rule" />
    </header>
  );
}
