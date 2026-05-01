type PinProps = {
  n: number;
  className?: string;
};

export function Pin({ n, className = "" }: PinProps) {
  return (
    <span
      aria-hidden
      className={`pin-dot ${className}`}
      style={{ verticalAlign: "middle" }}
    >
      {n}
    </span>
  );
}

type MarginNoteProps = {
  n: number;
  children: React.ReactNode;
  className?: string;
};

export function MarginNote({ n, children, className = "" }: MarginNoteProps) {
  return (
    <aside
      className={`hidden xl:flex items-start gap-3 max-w-[14rem] text-[13px] leading-snug text-ink-2 ${className}`}
    >
      <Pin n={n} className="shrink-0 mt-0.5" />
      <p className="font-mono tracking-tight pt-0.5">{children}</p>
    </aside>
  );
}
