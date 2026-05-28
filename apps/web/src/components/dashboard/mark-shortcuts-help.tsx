"use client";

import { Keyboard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

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
      { keys: ["S"], label: "Open project picker" },
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
          <DialogTitle className="inline-flex items-center gap-2 text-title-sm font-semibold text-ink">
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
              <p className="mb-1.5 text-ui-2xs font-medium uppercase tracking-[0.08em] text-ink-3">
                {group.heading}
              </p>
              <dl className="space-y-1 rounded-md bg-paper-2 p-1">
                {group.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-ui-sm"
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

        <p className="text-ui-xs text-ink-3">
          Press <Kbd className="min-w-[1.25rem]">?</Kbd> any time on the mark page to see this list.
        </p>
      </DialogContent>
    </Dialog>
  );
}
