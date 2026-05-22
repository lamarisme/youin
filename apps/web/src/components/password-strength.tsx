import { cn } from "@/lib/utils";

export type PasswordStrengthScore = 0 | 1 | 2 | 3;

export function getPasswordStrength(pw: string): PasswordStrengthScore {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12 || /[!@#$%^&*]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  return Math.min(score, 3) as PasswordStrengthScore;
}

export function PasswordStrength({ score }: { score: PasswordStrengthScore }) {
  const labels = ["Too short", "Weak", "Fair", "Strong"] as const;
  const colors = ["bg-paper-3", "bg-mark/60", "bg-mark", "bg-ok"] as const;
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-label="Password strength"
        className="flex flex-1 items-center gap-1"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "h-[3px] flex-1 rounded-full transition-colors duration-200",
              i < score ? colors[score] : "bg-paper-3",
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "font-mono text-ui-2xs uppercase tracking-wider",
          score === 0 ? "text-ink-3" : score === 3 ? "text-ok" : "text-ink-2",
        )}
      >
        {labels[score]}
      </span>
    </div>
  );
}
