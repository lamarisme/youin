import { MarkPin } from "@/components/mark-pin";
import { cn } from "@/lib/utils";

type LandingPinNoteProps = {
  pin: string;
  note: string;
  className?: string;
};

export function LandingPinNote({ pin, note, className }: LandingPinNoteProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 hidden items-start gap-2.5 lg:flex",
        className,
      )}
      aria-hidden
    >
      <MarkPin label={pin} size="md" className="shrink-0" />
      <p className="max-w-[16ch] pt-0.5 font-mono text-ui-2xs leading-snug text-ink-3">
        {note}
      </p>
    </div>
  );
}
