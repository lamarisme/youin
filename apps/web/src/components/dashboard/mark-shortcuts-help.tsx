"use client";

import { Keyboard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface MarkShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutGroup {
  heading: string;
  rows: Array<{ keys: string[]; label: string }>;
}

const GROUPS: ShortcutGroup[] = [
  {
    heading: "Navigate",
    rows: [
      { keys: ["J"], label: "Next mark" },
      { keys: ["K"], label: "Previous mark" },
      { keys: ["Esc"], label: "Back to triage" },
    ],
  },
  {
    heading: "Actions",
    rows: [
      { keys: ["X"], label: "Toggle close / reopen" },
      { keys: ["B"], label: "Toggle bookmark" },
      { keys: ["E"], label: "Edit title and description" },
    ],
  },
  {
    heading: "Focus",
    rows: [
      { keys: ["C"], label: "Focus comment composer" },
      { keys: ["A"], label: "Open assignee picker" },
      { keys: ["P"], label: "Open priority picker" },
      { keys: ["S"], label: "Open space picker" },
    ],
  },
  {
    heading: "Editing",
    rows: [
      { keys: ["⌘", "Enter"], label: "Save edit" },
      { keys: ["Esc"], label: "Cancel edit" },
    ],
  },
];

export function MarkShortcutsHelp({ open, onOpenChange }: MarkShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Keyboard className="size-4 text-ink-3" aria-hidden />
            Mark shortcuts
          </DialogTitle>
          <DialogDescription>
            Keyboard moves you faster through triage. Shortcuts work whenever you&apos;re not typing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {GROUPS.map((group) => (
            <section key={group.heading}>
              <p className="mb-1.5 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-3">
                {group.heading}
              </p>
              <dl className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-paper">
                {group.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-[0.8125rem]"
                  >
                    <dt className="text-ink-2">{row.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {row.keys.map((key, i) => (
                        <Kbd key={`${row.label}-${i}`}>{key}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <p className="text-[0.6875rem] text-ink-3">
          Press <Kbd inline>?</Kbd> any time on the mark page to see this list.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.5rem] items-center justify-center rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium text-ink-2",
        inline && "min-w-[1.25rem]",
      )}
    >
      {children}
    </kbd>
  );
}
